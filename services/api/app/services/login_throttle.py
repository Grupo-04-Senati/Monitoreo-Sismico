"""Control de intentos de acceso (rate limiting y bloqueo temporal).

Implementación en memoria adecuada para una sola instancia. En producción se
reemplaza por un backend compartido (Redis) — ver `REDIS_URL` en la config.
El login responde siempre con un error genérico para no revelar si el correo
existe; el bloqueo se evalúa por cuenta (correo) y por IP.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

#: Intentos fallidos permitidos antes del bloqueo temporal.
MAX_INTENTOS = 5
#: Duración del bloqueo temporal (segundos).
BLOQUEO_SEG = 15 * 60
#: Límite de intentos por IP dentro de la ventana.
MAX_INTENTOS_IP = 20
VENTANA_IP_SEG = 60

_intentos: dict[str, list[float]] = defaultdict(list)
_bloqueos: dict[str, float] = {}
_ip_intentos: dict[str, deque[float]] = defaultdict(deque)


def _ahora() -> float:
    return time.monotonic()


def segundos_bloqueado(email: str) -> int:
    """Segundos restantes de bloqueo para la cuenta (0 si no está bloqueada)."""
    restante = _bloqueos.get(email.lower(), 0) - _ahora()
    if restante <= 0:
        _bloqueos.pop(email.lower(), None)
        return 0
    return int(restante) + 1


def registrar_fallo(email: str) -> None:
    clave = email.lower()
    ahora = _ahora()
    recientes = [t for t in _intentos[clave] if ahora - t < BLOQUEO_SEG]
    recientes.append(ahora)
    _intentos[clave] = recientes
    if len(recientes) >= MAX_INTENTOS:
        _bloqueos[clave] = ahora + BLOQUEO_SEG
        _intentos[clave] = []


def limpiar_intentos(email: str) -> None:
    _intentos.pop(email.lower(), None)
    _bloqueos.pop(email.lower(), None)


def permitir_intento_ip(ip: str) -> bool:
    """Ventana deslizante por IP para frenar la fuerza bruta distribuida."""
    ahora = _ahora()
    cola = _ip_intentos[ip]
    while cola and ahora - cola[0] > VENTANA_IP_SEG:
        cola.popleft()
    if len(cola) >= MAX_INTENTOS_IP:
        return False
    cola.append(ahora)
    return True


__all__ = [
    "MAX_INTENTOS",
    "BLOQUEO_SEG",
    "segundos_bloqueado",
    "registrar_fallo",
    "limpiar_intentos",
    "permitir_intento_ip",
]
