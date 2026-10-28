"""Estimaciones experimentales de punta a punta contra PostgreSQL.

Dataset aprobado → modelo de conteo semanal aprobado → estimación de la semana en
curso → revisión. Comprueba la etiqueta experimental, el intervalo, la revisión
solo por el Administrador, que la regresión lineal no estima y que los valores
calculados no se modifican. Auditoría en memoria; al final se borra todo lo
creado (incluidos los archivos de modelo). Se omite sin catálogo histórico.

    pytest tests/api -q
"""

from __future__ import annotations

import asyncio

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

import app.services.datasets as servicio_datasets
import app.services.estimaciones as servicio_estimaciones
import app.services.ml_experimentos as servicio_ml
from app.core.permissions import get_current_user
from app.db.database import engine
from app.main import app
from app.services.ml_bridge import carpeta_artefactos

PREFIJO = "prueba_automatica_est"


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
                if not await conn.scalar(text("SELECT to_regclass('risk_estimates') IS NOT NULL")):
                    return None
                eventos = await conn.scalar(text("SELECT count(*) FROM seismic_events WHERE magnitude >= 4.5"))
                usuario = await conn.scalar(text("SELECT id FROM users ORDER BY created_at LIMIT 1"))
                return usuario if eventos and eventos > 500 and usuario else None
    except Exception:  # noqa: BLE001
        return None


USUARIO_ID = _ejecutar(_contexto)
if USUARIO_ID is None:
    pytest.skip("PostgreSQL no disponible, sin la migración 0015 o sin catálogo histórico", allow_module_level=True)


async def _limpiar() -> list[str]:
    p = {"p": f"{PREFIJO}%"}
    async with engine.begin() as conn:
        artefactos = (
            await conn.execute(text("SELECT artifact_uri FROM ml_experiments WHERE name LIKE :p AND artifact_uri IS NOT NULL"), p)
        ).scalars().all()
        await conn.execute(text("ALTER TABLE risk_estimates DISABLE TRIGGER trg_risk_estimates_valores_fijos"))
        await conn.execute(
            text("DELETE FROM risk_estimates WHERE model_id IN (SELECT id FROM model_registry WHERE name LIKE :p)"), p
        )
        await conn.execute(text("ALTER TABLE risk_estimates ENABLE TRIGGER trg_risk_estimates_valores_fijos"))
        await conn.execute(text("DELETE FROM model_registry WHERE name LIKE :p"), p)
        await conn.execute(text("DELETE FROM ml_experiments WHERE name LIKE :p"), p)
        await conn.execute(text("ALTER TABLE datasets DISABLE TRIGGER trg_datasets_inmutable"))
        await conn.execute(text("ALTER TABLE dataset_events DISABLE TRIGGER trg_dataset_events_instantanea"))
        await conn.execute(text("DELETE FROM datasets WHERE name LIKE :p"), p)
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
    for modulo in (servicio_datasets, servicio_ml, servicio_estimaciones):
        monkeypatch.setattr(modulo, "registrar_auditoria", registrar)
    yield eventos
    app.dependency_overrides.clear()
    for nombre in _ejecutar(_limpiar):
        (carpeta_artefactos() / nombre).unlink(missing_ok=True)


def _cliente(rol: str) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: _Usuario(rol)
    asyncio.run(engine.dispose(close=False))
    return TestClient(app)


def _modelo_aprobado(c: TestClient, tarea: str) -> str:
    d = c.post(
        "/api/v1/datasets",
        json={
            "name": f"{PREFIJO}_ds_{tarea}",
            "fuente": "usgs",
            "desde": "2000-01-01",
            "hasta": "2025-12-31",
            "reglas": {"magnitud_minima": 4.5, "sin_profundidad": "imputar_mediana"},
            "variables": ["occurred_at", "latitude", "longitude", "depth_km"],
            "variable_objetivo": "magnitude",
            "fecha_corte": "2021-01-01",
        },
    ).json()
    c.post(f"/api/v1/datasets/{d['id']}/approve")
    e = c.post("/api/v1/ml/experiments", json={"name": f"{PREFIJO}_{tarea}", "task_type": tarea, "dataset_id": d["id"]}).json()
    r = c.post(f"/api/v1/ml/models/{e['id']}/approve")
    if r.status_code != 200:
        pytest.skip(f"El mejor resultado de «{tarea}» es una referencia: no hay modelo que aprobar")
    return r.json()["id"]


def test_estimacion_con_intervalo_y_revision(auditoria):
    with _cliente("admin") as c:
        modelo_id = _modelo_aprobado(c, "conteo_semanal")

    with _cliente("analyst") as c:
        r = c.post("/api/v1/estimates", json={"model_id": modelo_id})
        assert r.status_code == 201, r.text
        e = r.json()
        assert e["categoria"] == "estimacion_experimental" and e["status"] == "en_revision"
        assert e["lower_bound"] <= e["value"] <= e["upper_bound"] and e["confidence_level"] == 0.9
        assert e["model_version"] == 1 and e["algorithm"]
        assert len(e["inputs"]["semanas"]) == 12 and "IGP" in e["disclaimer"]
        assert c.post(f"/api/v1/estimates/{e['id']}/publish").status_code == 403

    with _cliente("admin") as c:
        assert c.post(f"/api/v1/estimates/{e['id']}/publish").json()["status"] == "publicada"
        assert c.post(f"/api/v1/estimates/{e['id']}/publish").status_code == 409
        assert c.post(f"/api/v1/estimates/{e['id']}/withdraw").json()["status"] == "retirada"
        lista = c.get("/api/v1/estimates", params={"estado": "retirada"}).json()
        assert any(i["id"] == e["id"] for i in lista["items"]) and lista["disclaimer"]

    acciones = [a["action"] for a in auditoria]
    assert {"estimacion_creada", "estimacion_publicada", "estimacion_retirada"} <= set(acciones)

    async def _intentos():
        errores = []
        for sentencia in (
            "UPDATE risk_estimates SET value = value + 1 WHERE id = :i",
            "DELETE FROM risk_estimates WHERE id = :i",
        ):
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(sentencia), {"i": e["id"]})
            except DBAPIError as exc:
                errores.append(str(exc.orig))
        return errores

    errores = _ejecutar(_intentos)
    assert len(errores) == 2 and all("risk_estimates" in x for x in errores)


def test_regresion_lineal_no_genera_estimaciones(auditoria):
    with _cliente("admin") as c:
        modelo_id = _modelo_aprobado(c, "regresion_lineal")
        r = c.post("/api/v1/estimates", json={"model_id": modelo_id})
    assert r.status_code == 409 and "conteo semanal" in r.json()["detail"]
    assert not any(a["action"] == "estimacion_creada" for a in auditoria)


def test_sin_el_archivo_del_modelo_se_reconstruye_igual(auditoria):
    """Servidor sin disco persistente (Render gratuito) o volumen perdido: el modelo se
    reentrena con su dataset congelado y su semilla, y la estimación sale igual (D28)."""
    with _cliente("admin") as c:
        modelo_id = _modelo_aprobado(c, "conteo_semanal")
        experimento = next(m for m in c.get("/api/v1/ml/models").json()["items"] if m["id"] == modelo_id)
        primera = c.post("/api/v1/estimates", json={"model_id": modelo_id}).json()

    archivos = list(carpeta_artefactos().glob(f"{experimento['experiment_id']}.joblib"))
    assert archivos, "el entrenamiento debió guardar el archivo"
    for a in archivos:
        a.unlink()

    with _cliente("admin") as c:
        r = c.post("/api/v1/estimates", json={"model_id": modelo_id})
    assert r.status_code == 201, r.text
    segunda = r.json()
    assert (segunda["value"], segunda["lower_bound"], segunda["upper_bound"]) == (
        primera["value"], primera["lower_bound"], primera["upper_bound"],
    )
    assert carpeta_artefactos().joinpath(f"{experimento['experiment_id']}.joblib").is_file()


def test_dataset_por_zona_y_estimacion_del_mismo_sector(auditoria):
    """Un dataset del sector de la mina tiene menos filas que el de toda la cobertura, lo informa,
    y su estimación cuenta las semanas recientes en ese mismo sector."""
    base = {
        "fuente": "usgs", "desde": "2000-01-01", "hasta": "2025-12-31",
        "reglas": {"magnitud_minima": 4.5, "sin_profundidad": "imputar_mediana"},
        "variables": ["occurred_at", "latitude", "longitude", "depth_km"], "variable_objetivo": "magnitude",
        "fecha_corte": "2021-01-01",
    }
    zona = {"tipo": "circulo", "nombre": "Mina Arequipa", "lat": -16.4, "lon": -71.5, "radio_km": 300}
    with _cliente("admin") as c:
        todo = c.post("/api/v1/datasets", json={**base, "name": f"{PREFIJO}_zona_todo"}).json()
        sector = c.post("/api/v1/datasets", json={**base, "name": f"{PREFIJO}_zona_mina", "zona": zona}).json()
        depto = c.post("/api/v1/datasets", json={**base, "name": f"{PREFIJO}_zona_depto",
                                                 "zona": {"tipo": "departamentos", "departamentos": ["Arequipa"]}}).json()
        incompleta = c.post("/api/v1/datasets", json={**base, "name": f"{PREFIJO}_zona_mal", "zona": {"tipo": "circulo"}})
    assert incompleta.status_code == 422
    assert 0 < sector["row_count"] < todo["row_count"] and 0 < depto["row_count"] < todo["row_count"]
    informe = sector["quality_report"]["zona"]
    assert informe["descripcion"] == "Mina Arequipa: 300 km a la redonda" and informe["fuera_de_zona"] > 0
    assert sector["query_spec"]["zona"]["radio_km"] == 300
    assert todo["quality_report"]["zona"]["fuera_de_zona"] == 0

    # La estimación cuenta las semanas recientes en el mismo sector que el dataset.
    async def _conteos():
        from datetime import datetime, timezone

        from app.db.database import AsyncSessionLocal
        from app.db.models import Dataset

        inicio, fin = datetime(2025, 1, 6, tzinfo=timezone.utc), datetime(2025, 12, 29, tzinfo=timezone.utc)
        async with AsyncSessionLocal() as db:
            ds_todo, ds_sector = await db.get(Dataset, todo["id"]), await db.get(Dataset, sector["id"])
            return (
                sum((await servicio_estimaciones.conteos_recientes(db, ds_todo, inicio, fin))[1]),
                sum((await servicio_estimaciones.conteos_recientes(db, ds_sector, inicio, fin))[1]),
            )

    total_todo, total_sector = _ejecutar(_conteos)
    assert 0 < total_sector < total_todo

    with _cliente("admin") as c:
        c.post(f"/api/v1/datasets/{sector['id']}/approve")
        e = c.post("/api/v1/ml/experiments", json={"name": f"{PREFIJO}_zona", "task_type": "conteo_semanal", "dataset_id": sector["id"]}).json()
        r = c.post(f"/api/v1/ml/models/{e['id']}/approve")
        if r.status_code != 200:
            pytest.skip("En ese sector el mejor resultado es una referencia: no hay modelo que aprobar")
        est = c.post("/api/v1/estimates", json={"model_id": r.json()["id"]}).json()
    assert est["area_description"].startswith("Mina Arequipa: 300 km a la redonda")
