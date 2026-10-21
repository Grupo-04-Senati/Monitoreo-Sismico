"""Modelos de ML de punta a punta contra PostgreSQL (con el catálogo cargado).

Dataset aprobado → experimentos (conteo semanal y regresión lineal) → aprobación
del modelo. Comprueba que no se entrena con un dataset en borrador, que solo el
Administrador aprueba, que se guarda el artefacto y que un experimento no se
puede modificar. La auditoría se sustituye por listas en memoria y al final se
borra todo lo creado (incluidos los archivos de modelo). Se omite sin base.

    pytest tests/api -q
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

import app.services.datasets as servicio_datasets
import app.services.ml_experimentos as servicio_ml
from app.core.permissions import get_current_user
from app.db.database import engine
from app.main import app
from app.services.ml_bridge import carpeta_artefactos

PREFIJO = "prueba_automatica_ml"


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
                if not await conn.scalar(text("SELECT to_regclass('ml_experiments') IS NOT NULL")):
                    return None
                eventos = await conn.scalar(text("SELECT count(*) FROM seismic_events WHERE magnitude >= 4.5"))
                usuario = await conn.scalar(text("SELECT id FROM users ORDER BY created_at LIMIT 1"))
                return usuario if eventos and eventos > 500 and usuario else None
    except Exception:  # noqa: BLE001
        return None


USUARIO_ID = _ejecutar(_contexto)
if USUARIO_ID is None:
    pytest.skip("PostgreSQL no disponible, sin la migración 0014 o sin catálogo histórico", allow_module_level=True)


async def _limpiar() -> list[str]:
    async with engine.begin() as conn:
        artefactos = (
            await conn.execute(text("SELECT artifact_uri FROM ml_experiments WHERE name LIKE :p AND artifact_uri IS NOT NULL"), {"p": f"{PREFIJO}%"})
        ).scalars().all()
        await conn.execute(text("DELETE FROM model_registry WHERE name LIKE :p"), {"p": f"{PREFIJO}%"})
        await conn.execute(text("DELETE FROM ml_experiments WHERE name LIKE :p"), {"p": f"{PREFIJO}%"})
        await conn.execute(text("ALTER TABLE datasets DISABLE TRIGGER trg_datasets_inmutable"))
        await conn.execute(text("ALTER TABLE dataset_events DISABLE TRIGGER trg_dataset_events_instantanea"))
        await conn.execute(text("DELETE FROM datasets WHERE name LIKE :p"), {"p": f"{PREFIJO}%"})
        await conn.execute(text("ALTER TABLE dataset_events ENABLE TRIGGER trg_dataset_events_instantanea"))
        await conn.execute(text("ALTER TABLE datasets ENABLE TRIGGER trg_datasets_inmutable"))
    return list(artefactos)


class _Usuario:
    def __init__(self, rol: str) -> None:
        self.id = USUARIO_ID
        self.role_names = [rol]


@pytest.fixture
def auditoria(monkeypatch):
    eventos: list[dict] = []
    registrar = lambda **kw: eventos.append(kw)  # noqa: E731
    monkeypatch.setattr(servicio_datasets, "registrar_auditoria", registrar)
    monkeypatch.setattr(servicio_ml, "registrar_auditoria", registrar)
    yield eventos
    app.dependency_overrides.clear()
    for nombre in _ejecutar(_limpiar):
        (carpeta_artefactos() / nombre).unlink(missing_ok=True)


def _cliente(rol: str) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: _Usuario(rol)
    asyncio.run(engine.dispose(close=False))
    return TestClient(app)


DATASET = {
    "name": f"{PREFIJO}_dataset",
    "fuente": "usgs",
    "desde": "2000-01-01",
    "hasta": "2025-12-31",
    "reglas": {"magnitud_minima": 4.5, "sin_profundidad": "imputar_mediana"},
    "variables": ["occurred_at", "latitude", "longitude", "depth_km"],
    "variable_objetivo": "magnitude",
    "fecha_corte": "2021-01-01",
}


def test_de_dataset_a_modelo_aprobado(auditoria):
    with _cliente("admin") as c:
        dataset = c.post("/api/v1/datasets", json=DATASET).json()
        cuerpo = {"name": f"{PREFIJO}_conteo", "task_type": "conteo_semanal", "dataset_id": dataset["id"]}

        en_borrador = c.post("/api/v1/ml/experiments", json=cuerpo)
        assert en_borrador.status_code == 409 and "aprobados" in en_borrador.json()["detail"]

        assert c.post(f"/api/v1/datasets/{dataset['id']}/approve").status_code == 200
        conteo = c.post("/api/v1/ml/experiments", json=cuerpo)
        assert conteo.status_code == 201, conteo.text
        e1 = conteo.json()
        assert e1["status"] == "completado" and e1["error"] is None
        assert set(e1["metrics"]) >= {"referencia_media", "regresion_poisson"}
        assert e1["validation_spec"]["semanas_prueba"] > 200
        assert e1["library_versions"]["scikit-learn"] and e1["seed"] == 42
        assert e1["results"]["serie_prueba"] and e1["limitations"]
        assert (carpeta_artefactos() / e1["artifact_uri"]).is_file()

        lineal = c.post(
            "/api/v1/ml/experiments",
            json={"name": f"{PREFIJO}_lineal", "task_type": "regresion_lineal", "dataset_id": dataset["id"]},
        ).json()
        assert lineal["status"] == "completado" and lineal["target_name"] == "magnitude"
        assert "depth_km" in lineal["results"]["coeficientes"]["regresion_lineal"]

    with _cliente("analyst") as c:
        assert c.post(f"/api/v1/ml/models/{e1['id']}/approve").status_code == 403
        assert c.get(f"/api/v1/ml/experiments/{e1['id']}").status_code == 200

    with _cliente("admin") as c:
        r = c.post(f"/api/v1/ml/models/{e1['id']}/approve", json={"limitaciones": "Solo para prácticas del curso."})
        if e1["algorithm"].startswith("referencia_"):
            assert r.status_code == 409  # no hay modelo que aprobar si gana una referencia
        else:
            assert r.status_code == 200, r.text
            modelo = r.json()
            assert modelo["version"] == 1 and "prácticas del curso" in modelo["limitations"]
            assert c.post(f"/api/v1/ml/models/{e1['id']}/approve").status_code == 409
            assert c.get(f"/api/v1/ml/experiments/{e1['id']}").json()["model_id"] == modelo["id"]
            assert any(m["id"] == modelo["id"] for m in c.get("/api/v1/ml/models").json()["items"])

    acciones = [e["action"] for e in auditoria]
    assert acciones.count("ml_experimento_creado") == 2


def test_experimento_fallido_queda_registrado_y_no_se_modifica(auditoria):
    sin_corte = {**DATASET, "fecha_corte": None}
    with _cliente("admin") as c:
        dataset = c.post("/api/v1/datasets", json=sin_corte).json()
        c.post(f"/api/v1/datasets/{dataset['id']}/approve")
        r = c.post(
            "/api/v1/ml/experiments",
            json={"name": f"{PREFIJO}_fallido", "task_type": "conteo_semanal", "dataset_id": dataset["id"]},
        )
    assert r.status_code == 201
    e = r.json()
    assert e["status"] == "fallido" and "fecha de corte" in e["error"] and e["artifact_uri"] is None

    async def _modificar():
        try:
            async with engine.begin() as conn:
                await conn.execute(text("UPDATE ml_experiments SET status = 'completado' WHERE id = :i"), {"i": e["id"]})
        except DBAPIError as exc:
            return str(exc.orig)
        return None

    assert "inmutable" in (_ejecutar(_modificar) or "")
