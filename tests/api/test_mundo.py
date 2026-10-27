"""Vista mundial del mapa (D30): sismos M4.5+ del mundo en vivo, sin escribir en la base.

La descarga del USGS se simula: estas pruebas no usan internet ni base de datos.

    pytest tests/api -q
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "api"))

import app.services.mundo as mundo  # noqa: E402
from app.core.permissions import get_current_user  # noqa: E402
from app.main import app  # noqa: E402

FEED = {
    "metadata": {"generated": 1793120000000},
    "features": [
        {"id": "us7000aaaa", "properties": {"mag": 6.1, "magType": "mww", "place": "Honshu, Japan", "time": 1793110000000,
                                            "status": "reviewed", "url": "https://earthquake.usgs.gov/x/a"},
         "geometry": {"coordinates": [141.2, 37.5, 35.0]}},
        {"id": "us7000bbbb", "properties": {"mag": 4.8, "magType": "mb", "place": "40 km SW of Camaná, Peru", "time": 1793115000000,
                                            "status": "automatic", "url": "https://earthquake.usgs.gov/x/b"},
         "geometry": {"coordinates": [-72.9, -16.9, 60.2]}},
        {"id": "sin-magnitud", "properties": {"mag": None}, "geometry": {"coordinates": [0, 0, 0]}},
    ],
}


@dataclass
class _Usuario:
    role_names: list[str]
    id: str = "u-mundo"
    email: str = "mundo@test"
    is_active: bool = True


@pytest.fixture(autouse=True)
def _limpio():
    mundo.limpiar_cache()
    app.dependency_overrides[get_current_user] = lambda: _Usuario(role_names=["viewer"])
    yield
    app.dependency_overrides.clear()
    mundo.limpiar_cache()


def test_adapta_el_resumen_del_usgs():
    datos = mundo.adaptar(FEED, "semana")
    assert datos["total"] == 2  # el evento sin magnitud se descarta
    primero, segundo = datos["items"]
    assert primero["id"] == "us7000bbbb"  # más reciente primero
    assert primero["zona_peru"] is True and segundo["zona_peru"] is False
    assert segundo["magnitud"] == 6.1 and segundo["profundidad_km"] == 35.0
    assert primero["fecha"].endswith("Z")


def test_reutiliza_la_copia_y_usa_la_vieja_si_el_usgs_falla(monkeypatch):
    llamadas = {"n": 0}

    async def descarga_ok(_periodo):
        llamadas["n"] += 1
        return FEED

    monkeypatch.setattr(mundo, "_descargar", descarga_ok)
    with TestClient(app) as c:
        r1 = c.get("/api/v1/world/events", params={"periodo": "semana"})
        r2 = c.get("/api/v1/world/events", params={"periodo": "semana"})
    assert r1.status_code == r2.status_code == 200 and llamadas["n"] == 1  # caché
    assert r1.json()["desactualizado"] is False

    async def descarga_falla(_periodo):
        raise httpx.ConnectError("sin red")

    monkeypatch.setattr(mundo, "_descargar", descarga_falla)
    monkeypatch.setattr(mundo, "TTL_SEGUNDOS", 0)  # la copia ya venció
    with TestClient(app) as c:
        r3 = c.get("/api/v1/world/events", params={"periodo": "semana"})
        r4 = c.get("/api/v1/world/events", params={"periodo": "dia"})  # sin copia previa
    assert r3.status_code == 200 and r3.json()["desactualizado"] is True and r3.json()["total"] == 2
    assert r4.status_code == 503


def test_capa_de_paises_y_permiso_del_mapa():
    with TestClient(app) as c:
        capa = c.get("/api/v1/regions/mundo")
        assert capa.status_code == 200
        nombres = {f["properties"]["iso"]: f["properties"]["nombre"] for f in capa.json()["features"]}
        assert len(nombres) > 150 and nombres["PER"] == "Perú"
        assert c.get("/api/v1/world/events", params={"periodo": "anio"}).status_code == 422
        app.dependency_overrides.clear()
        assert c.get("/api/v1/world/events").status_code == 401  # sin sesión
