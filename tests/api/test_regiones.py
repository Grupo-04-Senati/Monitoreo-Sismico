"""Capa de departamentos del mapa (decisión D24). Sin base de datos."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.permissions import get_current_user
from app.main import app


class _Analista:
    id = "regiones-prueba"
    role_names = ["analyst"]


def test_capa_de_departamentos_con_nombres_de_la_plataforma():
    app.dependency_overrides[get_current_user] = lambda: _Analista()
    try:
        with TestClient(app) as c:
            r = c.get("/api/v1/regions/geojson")
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 200 and "max-age" in r.headers["cache-control"]
    datos = r.json()
    nombres = {f["properties"]["nombre"] for f in datos["features"]}
    assert len(datos["features"]) == 25 and {"Áncash", "Apurímac", "San Martín", "Callao"} <= nombres
