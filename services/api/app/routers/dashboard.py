"""Dashboard: resumen del sistema (módulo 6.10).

Todo se calcula en SQL sobre las tablas reales (`seismic_events`,
`ingestion_runs`, `data_sources`). La marca de "ahora" proviene del reloj único
(`app.core.clock.now()`), de modo que el resumen es coherente entre backend y
frontend.

`active_alerts` cuenta los avisos internos que piden acción: pendientes de
aprobación, aprobados aún sin entregar o con alguna entrega fallida (D19).
"""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now
from app.core.permissions import require_permission
from app.db.database import get_db
from app.db.models import Alert, AlertStatus, DataSource, IngestionRun, RunStatus, SeismicEvent, User

router = APIRouter()

_VER = Depends(require_permission("dashboard"))


async def _contar_eventos(db: AsyncSession, desde) -> int:
    consulta = select(func.count()).select_from(SeismicEvent)
    if desde is not None:
        consulta = consulta.where(SeismicEvent.occurred_at >= desde)
    return int((await db.execute(consulta)).scalar_one())


@router.get("/summary")
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    actor: User = _VER,
) -> dict:
    ahora = clock_now()

    total = await _contar_eventos(db, None)
    recientes = await _contar_eventos(db, ahora - timedelta(hours=24))
    ultimos_7d = await _contar_eventos(db, ahora - timedelta(days=7))
    ultimos_30d = await _contar_eventos(db, ahora - timedelta(days=30))

    ultima_sync = (
        await db.execute(select(func.max(IngestionRun.finished_at)))
    ).scalar_one()

    fuentes_activas = int(
        (
            await db.execute(
                select(func.count()).select_from(DataSource).where(DataSource.enabled.is_(True))
            )
        ).scalar_one()
    )

    fallidas = int(
        (
            await db.execute(
                select(func.count())
                .select_from(IngestionRun)
                .where(IngestionRun.status == RunStatus.FALLIDA)
            )
        ).scalar_one()
    )

    por_atender = int(
        (
            await db.execute(
                select(func.count())
                .select_from(Alert)
                .where(Alert.status.in_([AlertStatus.PENDIENTE_APROBACION, AlertStatus.APROBADA, AlertStatus.FALLIDA]))
            )
        ).scalar_one()
    )

    return {
        "total_events": total,
        "recent_events": recientes,
        "events_7d": ultimos_7d,
        "events_30d": ultimos_30d,
        "last_sync": ultima_sync.isoformat() if ultima_sync else None,
        "active_sources": fuentes_activas,
        "failed_runs": fallidas,
        "active_alerts": por_atender,
        "generated_at": ahora.isoformat(),
    }
