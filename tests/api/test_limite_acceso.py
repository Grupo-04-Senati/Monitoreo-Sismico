"""Límite de intentos de acceso (D25): mismas reglas en memoria y en Redis.

Las pruebas de Redis corren solo si hay un Redis en REDIS_URL (en el CI hay uno);
si no, se omiten. Nunca se usa el Redis de producción: se limpia el prefijo de prueba.

    pytest tests/api -q
"""

from __future__ import annotations

import asyncio

import pytest

import app.services.login_throttle as lt
from app.core.config import settings


@pytest.fixture(autouse=True)
def _limpio(monkeypatch):
    lt.reiniciar()
    yield
    lt.reiniciar()


async def _escenario() -> None:
    """Reglas: 5 fallos bloquean la cuenta; limpiar la desbloquea; 20 intentos por IP."""
    correo = "Prueba.Limite@Empresa-Ejemplo.pe"
    for _ in range(lt.MAX_INTENTOS - 1):
        await lt.registrar_fallo(correo)
    assert await lt.segundos_bloqueado(correo) == 0
    await lt.registrar_fallo(correo.lower())  # mayúsculas o no, es la misma cuenta
    assert 0 < await lt.segundos_bloqueado(correo) <= lt.BLOQUEO_SEG
    await lt.limpiar_intentos(correo)
    assert await lt.segundos_bloqueado(correo) == 0

    ip = "203.0.113.77"
    resultados = [await lt.permitir_intento_ip(ip) for _ in range(lt.MAX_INTENTOS_IP + 1)]
    assert all(resultados[:-1]) and resultados[-1] is False


def test_reglas_en_memoria(monkeypatch):
    monkeypatch.setattr(settings, "LOGIN_THROTTLE_BACKEND", "memoria")
    asyncio.run(_escenario())
    assert lt.estado()["almacen"] == "memoria"


def test_sin_redis_se_cuenta_en_memoria_y_se_avisa(monkeypatch):
    monkeypatch.setattr(settings, "LOGIN_THROTTLE_BACKEND", "auto")
    monkeypatch.setattr(settings, "REDIS_URL", "redis://127.0.0.1:1/0")  # puerto sin servicio
    asyncio.run(_escenario())
    est = lt.estado()
    assert est["almacen"] == "memoria" and "Redis no disponible" in est["detalle"]


async def _hay_redis() -> bool:
    try:
        import redis.asyncio as aioredis

        cliente = aioredis.from_url(settings.REDIS_URL, socket_connect_timeout=1, socket_timeout=1)
        await cliente.ping()
        await cliente.aclose()
        return True
    except Exception:  # noqa: BLE001
        return False


def test_reglas_en_redis_compartidas_y_sin_correos_en_claro(monkeypatch):
    if not asyncio.run(_hay_redis()):
        pytest.skip("Redis no disponible en REDIS_URL")
    monkeypatch.setattr(settings, "LOGIN_THROTTLE_BACKEND", "redis")
    monkeypatch.setattr(lt, "PREFIJO", "sismo:prueba-acceso")

    async def _caso():
        import redis.asyncio as aioredis

        try:
            await _escenario()
            assert lt.estado()["almacen"] == "redis"
            # Otro "proceso": un almacén nuevo lee los mismos contadores en Redis.
            await lt.registrar_fallo("otra@empresa-ejemplo.pe")
            lt.reiniciar()
            for _ in range(lt.MAX_INTENTOS - 1):
                await lt.registrar_fallo("otra@empresa-ejemplo.pe")
            assert await lt.segundos_bloqueado("otra@empresa-ejemplo.pe") > 0
            r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            claves = [k async for k in r.scan_iter("sismo:prueba-acceso:*")]
            assert claves and not any("@" in k or "empresa" in k for k in claves)
        finally:
            r = aioredis.from_url(settings.REDIS_URL)
            async for k in r.scan_iter("sismo:prueba-acceso:*"):
                await r.delete(k)
            await r.aclose()

    asyncio.run(_caso())


async def _hay_base() -> bool:
    from sqlalchemy import text

    from app.db.database import engine

    try:
        async with asyncio.timeout(5):
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        await engine.dispose()
        return True
    except Exception:  # noqa: BLE001
        return False


def test_login_bloquea_la_cuenta_tras_cinco_fallos(monkeypatch):
    if not asyncio.run(_hay_base()):
        pytest.skip("PostgreSQL no disponible")
    from fastapi.testclient import TestClient

    import app.routers.auth as router_auth
    from app.main import app

    monkeypatch.setattr(settings, "LOGIN_THROTTLE_BACKEND", "memoria")
    monkeypatch.setattr(router_auth, "registrar_auditoria", lambda **_k: None)
    datos = {"email": "no-existe-limite@empresa-ejemplo.pe", "password": "Incorrecta#123"}
    with TestClient(app) as c:
        codigos = [c.post("/api/v1/auth/login", json=datos).status_code for _ in range(lt.MAX_INTENTOS)]
        bloqueado = c.post("/api/v1/auth/login", json=datos)
    assert codigos == [401] * lt.MAX_INTENTOS
    assert bloqueado.status_code == 429 and "bloqueada" in bloqueado.json()["detail"]
