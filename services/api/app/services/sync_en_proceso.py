"""Sincronización automática dentro del proceso de la API (decisión D33).

En producción la programa Celery beat (worker + Redis). En la demo de Render no hay worker,
así que con `SYNC_EN_PROCESO=true` la API revisa cada minuto si a alguna fuente habilitada
le toca sincronizar (cada `INGESTION_INTERVAL_MINUTES`) y la sincroniza con el mismo motor:
ejecución registrada, correcciones del USGS y evaluación de las reglas de aviso.

Pensado para **un solo proceso** de la API (`API_WORKERS=1`). Si hay una ejecución en curso
o la última empezó hace menos del intervalo, no se lanza otra.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import func, select

from app.core.clock import now as clock_now
from app.core.config import settings
from app.db.database import AsyncSessionLocal
from app.db.models import DataSource, IngestionRun, RunStatus
from app.services.ingestion_runner import ejecutar_sincronizacion

logger = logging.getLogger("sismo.sync_en_proceso")

#: Una ejecución "en curso" más vieja que esto se da por colgada y no bloquea la siguiente.
COLGADA = timedelta(minutes=30)
REVISAR_CADA_SEG = 60
ESPERA_INICIAL_SEG = 30


def toca_sincronizar(ultimo_inicio: datetime | None, ultimo_estado: str | None, ahora: datetime, intervalo: timedelta) -> bool:
    if ultimo_inicio is None:
        return True
    if ultimo_estado == RunStatus.EN_CURSO and ahora - ultimo_inicio < COLGADA:
        return False
    return ahora - ultimo_inicio >= intervalo


async def _estado_fuentes() -> list[tuple[str, datetime | None, str | None]]:
    """(id de la fuente, inicio y estado de su última ejecución) de cada fuente habilitada."""
    async with AsyncSessionLocal() as db:
        fuentes = list((await db.execute(select(DataSource.id).where(DataSource.enabled.is_(True)))).scalars())
        salida = []
        for fid in fuentes:
            ultima = (
                await db.execute(
                    select(IngestionRun.started_at, IngestionRun.status)
                    .where(IngestionRun.source_id == fid)
                    .order_by(IngestionRun.started_at.desc())
                    .limit(1)
                )
            ).first()
            salida.append((fid, ultima[0] if ultima else None, ultima[1] if ultima else None))
        return salida


async def una_vuelta(ahora: datetime | None = None) -> list[str]:
    """Sincroniza las fuentes a las que les toca; devuelve los ids de las ejecuciones lanzadas."""
    ahora = ahora or clock_now()
    intervalo = timedelta(minutes=settings.INGESTION_INTERVAL_MINUTES)
    lanzadas = []
    for fid, inicio, estado in await _estado_fuentes():
        if toca_sincronizar(inicio, estado, ahora, intervalo):
            lanzadas.append(await ejecutar_sincronizacion(fid, triggered_by="scheduled"))
    return lanzadas


async def ciclo() -> None:
    """Bucle de fondo: revisa cada minuto mientras la API está encendida."""
    await asyncio.sleep(ESPERA_INICIAL_SEG)
    while True:
        try:
            ids = await una_vuelta()
            if ids:
                logger.info("sincronización automática: %d ejecución(es)", len(ids))
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - un fallo no detiene el bucle; queda en el log
            logger.exception("falló la sincronización automática")
        await asyncio.sleep(REVISAR_CADA_SEG)


__all__ = ["toca_sincronizar", "una_vuelta", "ciclo"]
