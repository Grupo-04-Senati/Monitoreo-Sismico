"""Paridad del catálogo compacto (`GET /events/compact`) con `GET /events`.

Las pantallas que agregan en el navegador pasan a usar el catálogo compacto; sus
números solo se mantienen si cada evento llega con exactamente los mismos
valores. Se compara campo por campo contra el listado paginado, sin filtros y
con filtros. Necesita PostgreSQL con eventos; si no, se omite.

    pytest tests/api -q
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.permissions import get_current_user
from app.db.database import engine
from app.main import app


async def _hay_eventos() -> bool:
    try:
        async with asyncio.timeout(5):
            async with engine.connect() as conn:
                return bool(await conn.scalar(text("SELECT count(*) FROM seismic_events")))
    except Exception:  # noqa: BLE001
        return False


async def _comprobar():
    try:
        return await _hay_eventos()
    finally:
        await engine.dispose()


if not asyncio.run(_comprobar()):
    pytest.skip("PostgreSQL no disponible o sin eventos", allow_module_level=True)


class _Usuario:
    id = "usuario-de-prueba"
    role_names = ["viewer"]  # el catálogo lo lee cualquier rol


@pytest.fixture
def cliente():
    app.dependency_overrides[get_current_user] = lambda: _Usuario()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _paginado(c: TestClient, filtros: dict) -> list[dict]:
    filas, pagina = [], 1
    while True:
        r = c.get("/api/v1/events", params={**filtros, "page": pagina, "page_size": 1000, "sort": "-occurred_at"}).json()
        filas += r["items"]
        if len(filas) >= r["total"] or not r["items"]:
            return filas
        pagina += 1


@pytest.mark.parametrize(
    "filtros",
    [
        {},
        {"mag_min": 5, "from": "2010-01-01T00:00:00Z", "to": "2020-12-31T23:59:59Z"},
        {"mag_type": "Mw", "depth_max": 70},
    ],
    ids=["sin_filtros", "magnitud_y_periodo", "tipo_y_profundidad"],
)
def test_compacto_coincide_campo_por_campo_con_el_listado(cliente, filtros):
    compacto = cliente.get("/api/v1/events/compact", params=filtros)
    assert compacto.status_code == 200
    cuerpo = compacto.json()
    columnas = cuerpo["columnas"]
    filas = [dict(zip(columnas, f)) for f in cuerpo["filas"]]

    esperado = _paginado(cliente, filtros)
    assert cuerpo["total"] == len(filas) == len(esperado)
    for recibido, referencia in zip(filas, esperado):
        assert recibido == {k: referencia[k] for k in columnas}


def test_compacto_exige_sesion():
    app.dependency_overrides.clear()
    with TestClient(app) as c:
        assert c.get("/api/v1/events/compact").status_code == 401
