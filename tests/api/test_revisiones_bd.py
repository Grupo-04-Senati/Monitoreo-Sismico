"""Revisiones de eventos de la fuente (D27) contra PostgreSQL.

Un evento de prueba (identificador `e2e-revision-*`, nunca uno real) pasa por: alta,
repetición, corrección con fecha más nueva, versión vieja ignorada y sin cambios. Se
comprueba el historial, que es de solo inserción, y la reconstrucción de valores a una
fecha (la que usan los datasets aprobados). Al final se borra lo creado.

    pytest tests/api -q
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.db.database import AsyncSessionLocal, engine
from app.db.models import SeismicEvent, SeismicEventRevision
from app.services import revisiones
from app.services.ingestion_bridge import NormalizedEvent
from app.services.ingestion_runner import RepositorioEventos, obtener_fuente

EXTERNO = f"e2e-revision-{uuid.uuid4().hex[:10]}"
T0 = datetime(2025, 6, 1, 12, 0, tzinfo=timezone.utc)


def _ejecutar(factoria):
    async def _envoltura():
        await engine.dispose(close=False)
        try:
            return await factoria()
        finally:
            await engine.dispose()

    return asyncio.run(_envoltura())


async def _fuente():
    try:
        async with asyncio.timeout(5):
            async with AsyncSessionLocal() as db:
                if not await db.scalar(text("SELECT to_regclass('seismic_event_revisions') IS NOT NULL")):
                    return None
                f = await obtener_fuente(db, "usgs")
                return f.id if f else None
    except Exception:  # noqa: BLE001
        return None


FUENTE = _ejecutar(_fuente)
if FUENTE is None:
    pytest.skip("PostgreSQL no disponible, sin la migración 0018 o sin la fuente usgs", allow_module_level=True)


def _evento(magnitud: float, actualizado: datetime, estado: str = "pendiente_validacion") -> NormalizedEvent:
    return NormalizedEvent(
        external_id=EXTERNO, occurred_at=T0, latitude=-16.5, longitude=-72.5, depth_km=40.0,
        magnitude=magnitud, magnitude_type="mb", region="Arequipa", origin_hash=f"h{magnitud}{estado}",
        locality="30 km SW of Camaná, Peru", source_url="https://earthquake.usgs.gov/x", review_status=estado,
        raw={"id": EXTERNO, "properties": {"mag": magnitud}}, source_updated_at=actualizado,
    )


async def _limpiar():
    async with engine.begin() as conn:
        ids = (await conn.execute(text("SELECT id FROM seismic_events WHERE external_id = :e"), {"e": EXTERNO})).scalars().all()
        if ids:
            await conn.execute(text("ALTER TABLE seismic_event_revisions DISABLE TRIGGER trg_seismic_event_revisions_inmutable"))
            await conn.execute(text("DELETE FROM seismic_event_revisions WHERE event_id = ANY(:i)"), {"i": list(ids)})
            await conn.execute(text("ALTER TABLE seismic_event_revisions ENABLE TRIGGER trg_seismic_event_revisions_inmutable"))
            await conn.execute(text("DELETE FROM seismic_events WHERE id = ANY(:i)"), {"i": list(ids)})


@pytest.fixture(autouse=True)
def _limpieza():
    yield
    _ejecutar(_limpiar)


def test_ciclo_de_revision_e_historial():
    async def _caso():
        async with AsyncSessionLocal() as db:
            repo = RepositorioEventos(db, FUENTE)
            r1 = await repo.upsert(_evento(4.6, T0 + timedelta(hours=1)))
            r2 = await repo.upsert(_evento(4.6, T0 + timedelta(hours=1)))  # repetido
            r3 = await repo.upsert(_evento(4.9, T0 + timedelta(days=3), "observado"))  # corrección
            r4 = await repo.upsert(_evento(4.5, T0 + timedelta(days=1)))  # versión vieja: se ignora
            r5 = await repo.upsert(_evento(4.9, T0 + timedelta(days=5), "observado"))  # más nueva, sin cambios
            await db.commit()
            e = (await db.execute(select(SeismicEvent).where(SeismicEvent.external_id == EXTERNO))).scalar_one()
            revs = (await db.execute(select(SeismicEventRevision).where(SeismicEventRevision.event_id == e.id))).scalars().all()
            return (r1, r2, r3, r4, r5), e, revs

    resultados, e, revs = _ejecutar(_caso)
    assert resultados == (True, False, "actualizado", False, False)
    assert (e.magnitude, e.review_status, e.revision_count) == (4.9, "observado", 1)
    assert e.revised_at is not None and e.source_updated_at == T0 + timedelta(days=5)
    assert len(revs) == 1
    assert revs[0].before_json["magnitude"] == 4.6 and revs[0].after_json["magnitude"] == 4.9
    assert revs[0].before_json["review_status"] == "pendiente_validacion"


def test_valores_a_la_fecha_y_historial_inmutable():
    async def _caso():
        async with AsyncSessionLocal() as db:
            repo = RepositorioEventos(db, FUENTE)
            await repo.upsert(_evento(4.6, T0 + timedelta(hours=1)))
            await db.commit()
            e = (await db.execute(select(SeismicEvent).where(SeismicEvent.external_id == EXTERNO))).scalar_one()
            antes_de_corregir = datetime.now(timezone.utc)
            await asyncio.sleep(0.01)
            assert await repo.upsert(_evento(5.2, T0 + timedelta(days=2))) == "actualizado"
            await db.commit()
            await db.refresh(e)
            pasado = await revisiones.valores_a_la_fecha(db, [e.id], antes_de_corregir)
            presente = await revisiones.valores_a_la_fecha(db, [e.id], datetime.now(timezone.utc))
            return e, pasado, presente

    e, pasado, presente = _ejecutar(_caso)
    assert e.magnitude == 5.2
    assert revisiones.valor(e, "magnitude", pasado) == 4.6  # como era al crear un dataset antes
    assert presente == {} and revisiones.valor(e, "magnitude", presente) == 5.2

    async def _alterar():
        async with engine.begin() as conn:
            await conn.execute(
                text("UPDATE seismic_event_revisions SET after_json = '{}' WHERE event_id = :i"), {"i": e.id}
            )

    with pytest.raises(DBAPIError, match="solo insercion"):
        _ejecutar(_alterar)
