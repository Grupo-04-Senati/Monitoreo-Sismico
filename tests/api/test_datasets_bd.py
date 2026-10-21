"""Datasets de punta a punta contra PostgreSQL (con el catálogo ya cargado).

Crea datasets por la API, comprueba versión, informe, vista previa y aprobación,
y que el trigger impide modificar un dataset aprobado. La auditoría se sustituye
por una lista en memoria (para no dejar filas en `audit_logs`, que es inmutable)
y al final se borran los datasets de prueba. Se omite si la base no responde o
no tiene eventos ni usuarios.

    pytest tests/api -q
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

import app.services.datasets as servicio_datasets
from app.core.permissions import get_current_user
from app.db.database import engine
from app.main import app

NOMBRE = "prueba_automatica_dataset"


def _ejecutar(factoria):
    async def _envoltura():
        await engine.dispose(close=False)
        try:
            return await factoria()
        finally:
            await engine.dispose()

    return asyncio.run(_envoltura())


async def _contexto():
    try:
        async with asyncio.timeout(5):
            async with engine.connect() as conn:
                if not await conn.scalar(text("SELECT to_regclass('datasets') IS NOT NULL")):
                    return None
                # Hace falta catálogo en el periodo de la prueba (2015-2024), no solo "algún" evento:
                # la muestra del CI (2025) no lo tiene y entonces la prueba se omite.
                eventos = await conn.scalar(text(
                    "SELECT count(*) FROM seismic_events WHERE occurred_at >= '2015-01-01' AND occurred_at < '2025-01-01'"
                ))
                usuario = await conn.scalar(text("SELECT id FROM users ORDER BY created_at LIMIT 1"))
                return usuario if eventos and usuario else None
    except Exception:  # noqa: BLE001
        return None


USUARIO_ID = _ejecutar(_contexto)
if USUARIO_ID is None:
    pytest.skip("PostgreSQL no disponible, sin la migración 0013, sin usuarios o sin catálogo 2015-2024", allow_module_level=True)


async def _limpiar():
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE datasets DISABLE TRIGGER trg_datasets_inmutable"))
        await conn.execute(text("ALTER TABLE dataset_events DISABLE TRIGGER trg_dataset_events_instantanea"))
        await conn.execute(text("DELETE FROM datasets WHERE name = :n"), {"n": NOMBRE})
        await conn.execute(text("ALTER TABLE dataset_events ENABLE TRIGGER trg_dataset_events_instantanea"))
        await conn.execute(text("ALTER TABLE datasets ENABLE TRIGGER trg_datasets_inmutable"))


class _Usuario:
    def __init__(self, rol: str) -> None:
        self.id = USUARIO_ID
        self.role_names = [rol]


@pytest.fixture
def auditoria(monkeypatch):
    eventos: list[dict] = []
    monkeypatch.setattr(servicio_datasets, "registrar_auditoria", lambda **kw: eventos.append(kw))
    yield eventos
    app.dependency_overrides.clear()
    _ejecutar(_limpiar)


def _cliente(rol: str) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: _Usuario(rol)
    # Cada TestClient tiene su propio bucle: no reutilizar conexiones del anterior.
    asyncio.run(engine.dispose(close=False))
    return TestClient(app)


SOLICITUD = {
    "name": NOMBRE,
    "fuente": "usgs",
    "desde": "2015-01-01",
    "hasta": "2024-12-31",
    "reglas": {"magnitud_minima": 4.5, "sin_profundidad": "imputar_mediana", "posibles_duplicados": "excluir"},
    "variables": ["occurred_at", "latitude", "longitude", "depth_km"],
    "variable_objetivo": "magnitude",
    "fecha_corte": "2023-01-01",
}


def test_crear_versionar_previsualizar_y_aprobar(auditoria):
    with _cliente("analyst") as c:
        r1 = c.post("/api/v1/datasets", json=SOLICITUD)
        assert r1.status_code == 201, r1.text
        d1 = r1.json()
        informe = d1["quality_report"]
        assert d1["version"] == 1 and d1["status"] == "borrador"
        assert d1["row_count"] == informe["filas_finales"] > 0
        assert informe["magnitud"]["minimo"] >= 4.5
        particion = informe["particion"]
        assert particion["entrenamiento"] + particion["prueba"] == d1["row_count"]

        r2 = c.post("/api/v1/datasets", json=SOLICITUD)
        assert r2.json()["version"] == 2  # mismo nombre → nueva versión

        filas = c.get(f"/api/v1/datasets/{d1['id']}/rows", params={"split": "prueba", "page_size": 5}).json()
        assert filas["total"] == particion["prueba"]
        assert all(f["split"] == "prueba" and f["occurred_at"] >= "2023-01-01" for f in filas["items"])

        calidad = c.get(f"/api/v1/datasets/{d1['id']}/quality").json()
        assert calidad["quality_report"] == informe

        # El analista no puede aprobar.
        assert c.post(f"/api/v1/datasets/{d1['id']}/approve").status_code == 403

    with _cliente("admin") as c:
        aprobado = c.post(f"/api/v1/datasets/{d1['id']}/approve")
        assert aprobado.status_code == 200 and aprobado.json()["status"] == "aprobado"
        assert c.post(f"/api/v1/datasets/{d1['id']}/approve").status_code == 409

    assert [e["action"] for e in auditoria] == ["dataset_creado", "dataset_creado", "dataset_aprobado"]


def test_dataset_aprobado_es_inmutable_en_la_base(auditoria):
    with _cliente("admin") as c:
        d = c.post("/api/v1/datasets", json=SOLICITUD).json()
        c.post(f"/api/v1/datasets/{d['id']}/approve")

    async def _intentos():
        errores = []
        for sentencia in (
            "UPDATE datasets SET row_count = 0 WHERE id = :i",
            "DELETE FROM datasets WHERE id = :i",
            "DELETE FROM dataset_events WHERE dataset_id = :i",
        ):
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(sentencia), {"i": d["id"]})
            except DBAPIError as exc:
                errores.append(str(exc.orig))
        return errores

    errores = _ejecutar(_intentos)
    assert len(errores) == 3
    assert all("aprobado" in e for e in errores)


def test_periodo_sin_eventos_responde_422(auditoria):
    with _cliente("analyst") as c:
        r = c.post(
            "/api/v1/datasets",
            json={**SOLICITUD, "desde": "1990-01-01", "hasta": "1990-01-31", "fecha_corte": None},
        )
    assert r.status_code == 422
    assert "ningún evento" in r.json()["detail"]
    assert auditoria == []
