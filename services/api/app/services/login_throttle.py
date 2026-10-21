"""Control de intentos de acceso (límite por IP y bloqueo temporal por cuenta).

Reglas: 5 intentos fallidos bloquean la cuenta 15 minutos; una IP puede intentar
20 veces por minuto. El login responde siempre con un error genérico para no
revelar si el correo existe.

Dónde se cuentan los intentos (decisión D25, `LOGIN_THROTTLE_BACKEND`):
- **Redis** (`auto` con Redis disponible, o `redis`): contadores compartidos entre
  todos los procesos de la API, así subir `API_WORKERS` no multiplica los intentos.
  Los correos se guardan como huella SHA-256, nunca en claro.
- **Memoria** (`memoria`, o `auto` sin Redis): válido para un solo proceso
  (desarrollo y pruebas). Si Redis falla en marcha, se pasa a memoria: el límite
  sigue activo por proceso y el monitoreo lo avisa.
"""

from __future__ import annotations

import hashlib
import logging
import time
from collections import defaultdict, deque
from typing import Any

from app.core.config import settings

#: Intentos fallidos permitidos antes del bloqueo temporal.
MAX_INTENTOS = 5
#: Duración del bloqueo temporal (segundos).
BLOQUEO_SEG = 15 * 60
#: Límite de intentos por IP dentro de la ventana.
MAX_INTENTOS_IP = 20
VENTANA_IP_SEG = 60
#: Cada cuánto se vuelve a probar Redis si no respondía.
REINTENTO_REDIS_SEG = 60

PREFIJO = "sismo:acceso"
_log = logging.getLogger("sismo.acceso")


def _huella(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


class _Memoria:
    nombre = "memoria"

    def __init__(self) -> None:
        self.intentos: dict[str, list[float]] = defaultdict(list)
        self.bloqueos: dict[str, float] = {}
        self.ip: dict[str, deque[float]] = defaultdict(deque)

    async def segundos_bloqueado(self, clave: str) -> int:
        restante = self.bloqueos.get(clave, 0) - time.monotonic()
        if restante <= 0:
            self.bloqueos.pop(clave, None)
            return 0
        return int(restante) + 1

    async def registrar_fallo(self, clave: str) -> None:
        ahora = time.monotonic()
        recientes = [t for t in self.intentos[clave] if ahora - t < BLOQUEO_SEG] + [ahora]
        if len(recientes) >= MAX_INTENTOS:
            self.bloqueos[clave] = ahora + BLOQUEO_SEG
            recientes = []
        self.intentos[clave] = recientes

    async def limpiar(self, clave: str) -> None:
        self.intentos.pop(clave, None)
        self.bloqueos.pop(clave, None)

    async def permitir_ip(self, ip: str) -> bool:
        ahora = time.monotonic()
        cola = self.ip[ip]
        while cola and ahora - cola[0] > VENTANA_IP_SEG:
            cola.popleft()
        if len(cola) >= MAX_INTENTOS_IP:
            return False
        cola.append(ahora)
        return True


class _Redis:
    nombre = "redis"

    def __init__(self, cliente: Any) -> None:
        self.r = cliente

    async def segundos_bloqueado(self, clave: str) -> int:
        ttl = await self.r.ttl(f"{PREFIJO}:bloqueo:{clave}")
        return max(int(ttl), 0)

    async def registrar_fallo(self, clave: str) -> None:
        fallos = f"{PREFIJO}:fallos:{clave}"
        n = await self.r.incr(fallos)
        if n == 1:
            await self.r.expire(fallos, BLOQUEO_SEG)
        if n >= MAX_INTENTOS:
            await self.r.set(f"{PREFIJO}:bloqueo:{clave}", "1", ex=BLOQUEO_SEG)
            await self.r.delete(fallos)

    async def limpiar(self, clave: str) -> None:
        await self.r.delete(f"{PREFIJO}:fallos:{clave}", f"{PREFIJO}:bloqueo:{clave}")

    async def permitir_ip(self, ip: str) -> bool:
        """Ventana deslizante con un conjunto ordenado por marca de tiempo."""
        clave = f"{PREFIJO}:ip:{ip}"
        ahora = time.time()
        async with self.r.pipeline(transaction=True) as p:
            p.zremrangebyscore(clave, 0, ahora - VENTANA_IP_SEG)
            p.zcard(clave)
            _, n = await p.execute()
        if n >= MAX_INTENTOS_IP:
            return False
        async with self.r.pipeline(transaction=True) as p:
            p.zadd(clave, {f"{ahora}:{time.perf_counter_ns()}": ahora})
            p.expire(clave, VENTANA_IP_SEG)
            await p.execute()
        return True


_memoria = _Memoria()
_redis: _Redis | None = None
_ultimo_fallo_redis = 0.0
_motivo = "sin usar todavía"


async def _almacen() -> _Memoria | _Redis:
    """Redis si corresponde y responde; si no, memoria (y se recuerda por qué)."""
    global _redis, _ultimo_fallo_redis, _motivo
    modo = settings.LOGIN_THROTTLE_BACKEND.strip().lower()
    if modo == "memoria":
        _motivo = "configurado en memoria"
        return _memoria
    if _redis is not None:
        return _redis
    if _ultimo_fallo_redis and time.monotonic() - _ultimo_fallo_redis < REINTENTO_REDIS_SEG:
        return _memoria
    try:
        import redis.asyncio as aioredis

        cliente = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1, decode_responses=True)
        await cliente.ping()
        _redis = _Redis(cliente)
        _motivo = "compartido entre procesos"
        return _redis
    except Exception as exc:  # noqa: BLE001 - sin Redis se sigue con memoria
        _ultimo_fallo_redis = time.monotonic()
        _motivo = f"Redis no disponible ({type(exc).__name__}): se cuenta en memoria"
        if modo == "redis":
            _log.error("LOGIN_THROTTLE_BACKEND=redis pero Redis no responde: se usa memoria. %s", exc)
        return _memoria


async def _con_respaldo(operacion: str, *args: Any) -> Any:
    """Ejecuta en Redis; si falla en marcha, repite en memoria y vuelve a probar Redis luego."""
    global _redis, _ultimo_fallo_redis, _motivo
    almacen = await _almacen()
    try:
        return await getattr(almacen, operacion)(*args)
    except Exception as exc:  # noqa: BLE001
        if almacen is _memoria:
            raise
        _log.warning("Redis falló en el límite de acceso (%s): se usa memoria.", type(exc).__name__)
        _redis, _ultimo_fallo_redis = None, time.monotonic()
        _motivo = f"Redis falló ({type(exc).__name__}): se cuenta en memoria"
        return await getattr(_memoria, operacion)(*args)


async def segundos_bloqueado(email: str) -> int:
    """Segundos restantes de bloqueo para la cuenta (0 si no está bloqueada)."""
    return await _con_respaldo("segundos_bloqueado", _huella(email))


async def registrar_fallo(email: str) -> None:
    await _con_respaldo("registrar_fallo", _huella(email))


async def limpiar_intentos(email: str) -> None:
    await _con_respaldo("limpiar", _huella(email))


async def permitir_intento_ip(ip: str) -> bool:
    """Ventana deslizante por IP para frenar la fuerza bruta distribuida."""
    return await _con_respaldo("permitir_ip", ip)


def estado() -> dict[str, str]:
    """Dónde se cuentan hoy los intentos (para el monitoreo y la configuración)."""
    return {"almacen": "redis" if _redis is not None else "memoria", "detalle": _motivo}


def reiniciar() -> None:
    """Solo para pruebas: olvida contadores y la conexión elegida."""
    global _memoria, _redis, _ultimo_fallo_redis, _motivo
    _memoria, _redis, _ultimo_fallo_redis, _motivo = _Memoria(), None, 0.0, "sin usar todavía"


__all__ = [
    "MAX_INTENTOS", "BLOQUEO_SEG", "MAX_INTENTOS_IP", "segundos_bloqueado", "registrar_fallo",
    "limpiar_intentos", "permitir_intento_ip", "estado", "reiniciar",
]
