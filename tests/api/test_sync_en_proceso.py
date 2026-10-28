"""Sincronización automática dentro de la API (D33), sin base de datos ni internet.

    pytest tests/api -q
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import app.services.sync_en_proceso as sync
from app.core.config import settings
from app.db.models import RunStatus

AHORA = datetime(2026, 10, 28, 12, 0, tzinfo=timezone.utc)
QUINCE = timedelta(minutes=15)


def test_cuando_toca_sincronizar():
    assert sync.toca_sincronizar(None, None, AHORA, QUINCE)  # nunca se sincronizó
    assert sync.toca_sincronizar(AHORA - timedelta(minutes=16), RunStatus.CORRECTA, AHORA, QUINCE)
    assert not sync.toca_sincronizar(AHORA - timedelta(minutes=5), RunStatus.CORRECTA, AHORA, QUINCE)
    assert not sync.toca_sincronizar(AHORA - timedelta(minutes=20), RunStatus.EN_CURSO, AHORA, QUINCE)  # en curso
    assert sync.toca_sincronizar(AHORA - timedelta(minutes=40), RunStatus.EN_CURSO, AHORA, QUINCE)  # colgada


def test_una_vuelta_sincroniza_solo_las_que_tocan(monkeypatch):
    estado = [
        ("vencida", AHORA - timedelta(minutes=30), RunStatus.CORRECTA),
        ("reciente", AHORA - timedelta(minutes=2), RunStatus.CORRECTA),
        ("nueva", None, None),
    ]
    lanzadas: list[tuple[str, str]] = []

    async def estado_falso():
        return estado

    async def ejecutar_falso(fid, *, triggered_by):
        lanzadas.append((fid, triggered_by))
        return f"run-{fid}"

    monkeypatch.setattr(sync, "_estado_fuentes", estado_falso)
    monkeypatch.setattr(sync, "ejecutar_sincronizacion", ejecutar_falso)
    monkeypatch.setattr(settings, "INGESTION_INTERVAL_MINUTES", 15)
    ids = asyncio.run(sync.una_vuelta(AHORA))
    assert ids == ["run-vencida", "run-nueva"]
    assert lanzadas == [("vencida", "scheduled"), ("nueva", "scheduled")]
