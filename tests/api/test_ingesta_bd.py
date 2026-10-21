"""Idempotencia de la ingesta contra PostgreSQL (HANDOFF §4.3).

Repetir la sincronización no duplica filas por `(source_id, external_id)`.
Usa el repositorio real (`INSERT ... ON CONFLICT DO NOTHING`) dentro de una
transacción que se deshace al final: no deja eventos de prueba en la base.
Necesita la migración `0012_fuente_usgs`; si la base no responde, se omite.

    pytest tests/api -q
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest
from sqlalchemy import func, select, text

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "tests" / "ingestion"))

from app.db.database import AsyncSessionLocal, engine  # noqa: E402
from app.db.models import DataSource, SeismicEvent  # noqa: E402
from app.services.ingestion_bridge import run_sync  # noqa: E402
from app.services.ingestion_runner import RepositorioEventos  # noqa: E402
from ingestion.normalizers.usgs import UsgsNormalizer  # noqa: E402
from test_usgs import _ConectorFijo, _feature  # noqa: E402


async def _hay_fuente_usgs() -> bool:
    try:
        async with asyncio.timeout(5):
            async with engine.connect() as conn:
                return bool(await conn.scalar(text("SELECT count(*) FROM data_sources WHERE key = 'usgs'")))
    except Exception:  # noqa: BLE001
        return False


def _ejecutar(factoria):
    async def _envoltura():
        try:
            return await factoria()
        finally:
            await engine.dispose()

    return asyncio.run(_envoltura())


if not _ejecutar(_hay_fuente_usgs):
    pytest.skip("PostgreSQL no disponible o sin la migración 0012", allow_module_level=True)


def test_sincronizar_dos_veces_no_duplica_en_postgres():
    respuesta = {"features": [_feature("prueba-bd-1"), _feature("prueba-bd-2")]}

    async def _caso():
        async with AsyncSessionLocal() as db:
            fuente = (await db.execute(select(DataSource).where(DataSource.key == "usgs"))).scalar_one()
            repo = RepositorioEventos(db, fuente.id)
            reportes = []
            for _ in range(2):
                reportes.append(
                    await run_sync(
                        connector=_ConectorFijo(respuesta),
                        normalizer=UsgsNormalizer(),
                        repository=repo,
                        since=None,
                    )
                )
            filas = await db.scalar(
                select(func.count()).select_from(SeismicEvent).where(
                    SeismicEvent.source_id == fuente.id,
                    SeismicEvent.external_id.in_(["prueba-bd-1", "prueba-bd-2"]),
                )
            )
            await db.rollback()  # nada de esto queda en la base
            return reportes, filas

    (primera, segunda), filas = _ejecutar(_caso)
    assert (primera.insertados, primera.duplicados) == (2, 0)
    assert (segunda.insertados, segunda.duplicados) == (0, 2)
    assert filas == 2
