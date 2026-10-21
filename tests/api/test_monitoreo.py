"""Estado operativo (PDF §12): latencia, copias de seguridad y comprobaciones contra la base.

    pytest tests/api -q
"""

from __future__ import annotations

import asyncio
import os
import time
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

import app.services.monitoreo as monitoreo
from app.core.permissions import get_current_user
from app.db.database import engine
from app.main import app


def test_percentiles_y_errores_de_latencia():
    lat = monitoreo._Latencias(tamano=100)
    for ms in range(1, 101):
        lat.registrar(float(ms), 500 if ms == 100 else 200)
    r = lat.resumen()
    assert r["peticiones"] == 100 and r["p50_ms"] == 51.0 and r["p95_ms"] == 96.0 and r["errores_5xx"] == 1


def test_latencia_con_pocas_peticiones_no_alarma(monkeypatch):
    monkeypatch.setattr(monitoreo, "latencias", monitoreo._Latencias())
    assert monitoreo._latencia()["estado"] == "sin_datos"


def test_copias_de_seguridad(monkeypatch, tmp_path):
    ahora = datetime.now(timezone.utc)
    monkeypatch.setattr(monitoreo.settings, "MONITOREO_BACKUP_DIR", "")
    assert monitoreo._copias(ahora)["estado"] == "sin_datos"

    monkeypatch.setattr(monitoreo.settings, "MONITOREO_BACKUP_DIR", str(tmp_path))
    assert monitoreo._copias(ahora)["estado"] == "critico"  # carpeta sin copias

    copia = tmp_path / "sismo_db_20261021T000000Z.dump"
    copia.write_bytes(b"x" * 2048)
    assert monitoreo._copias(ahora)["estado"] == "ok"

    vieja = time.time() - 60 * 3600
    os.utime(copia, (vieja, vieja))
    c = monitoreo._copias(ahora)
    assert c["estado"] == "critico" and c["datos"]["horas"] > 50


async def _hay_base() -> bool:
    try:
        async with asyncio.timeout(5):
            async with engine.connect() as conn:
                return bool(await conn.scalar(text("SELECT to_regclass('alerts') IS NOT NULL")))
    except Exception:  # noqa: BLE001
        return False


@pytest.fixture
def con_base():
    disponible = asyncio.run(_hay_base())
    # Las conexiones abiertas en ese bucle no sirven en el del TestClient: se sueltan.
    asyncio.run(engine.dispose(close=False))
    if not disponible:
        pytest.skip("PostgreSQL no disponible")
    yield
    app.dependency_overrides.clear()


class _Admin:
    id = "monitoreo-prueba"
    role_names = ["admin"]


def test_estado_operativo_y_readiness(con_base):
    app.dependency_overrides[get_current_user] = lambda: _Admin()
    with TestClient(app) as c:
        assert c.get("/health/ready").json() == {"status": "ok"}
        r = c.get("/api/v1/monitoring").json()
    claves = {x["clave"] for x in r["comprobaciones"]}
    assert {"base_datos", "ejecuciones", "avisos", "latencia", "copias"} <= claves
    assert any(k.startswith("ingesta") for k in claves)
    assert r["estado"] in {"ok", "degradado", "critico"}
    base = next(x for x in r["comprobaciones"] if x["clave"] == "base_datos")
    assert base["estado"] in {"ok", "aviso"} and base["datos"]["ms"] >= 0


def test_latencia_se_registra_en_peticiones_api(con_base):
    antes = monitoreo.latencias.resumen()["peticiones"]
    with TestClient(app) as c:
        c.get("/api/v1/meta")
        c.get("/health")  # fuera de /api: no cuenta
    assert monitoreo.latencias.resumen()["peticiones"] == antes + 1
