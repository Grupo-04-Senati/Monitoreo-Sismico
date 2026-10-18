"""Motor de ingesta.

Orquesta una sincronización: obtiene los registros crudos del `Connector`, los
normaliza y los persiste mediante un repositorio, respetando reintentos con
backoff y un timeout. Devuelve un `SyncReport` que alimenta `ingestion_runs`.

Es puro respecto a la base de datos: el repositorio se inyecta, por lo que el
mismo motor sirve para Postgres, una prueba en memoria o una CLI.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from typing import Awaitable, Callable, Protocol

from ingestion.connectors.base import Connector, ConnectorError
from ingestion.models import NormalizedEvent, SyncReport
from ingestion.normalizers.base import Normalizer

logger = logging.getLogger("sismo.ingestion")

#: Intervalos de backoff (segundos) entre reintentos.
BACKOFF_BASE_SEG = 0.5
MAX_INTENTOS_EXTRA = 2


class EventRepository(Protocol):
    """Destino de la ingesta. `upsert` devuelve `True` si insertó una fila nueva."""

    async def upsert(self, event: NormalizedEvent) -> bool:
        ...


async def run_sync(
    *,
    connector: Connector,
    normalizer: Normalizer,
    repository: EventRepository,
    since: datetime | None,
    retries: int = MAX_INTENTOS_EXTRA,
    backoff_base: float = BACKOFF_BASE_SEG,
    timeout_sec: float = 30.0,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
) -> SyncReport:
    """Ejecuta una sincronización completa y devuelve su reporte."""
    report = SyncReport()
    registros = None

    for intento in range(1, retries + 2):
        report.intentos = intento
        inicio = time.perf_counter()
        try:
            registros = await asyncio.wait_for(
                asyncio.to_thread(connector.fetch, since), timeout=timeout_sec
            )
        except (ConnectorError, asyncio.TimeoutError, OSError) as exc:
            report.error = str(exc) or exc.__class__.__name__
            logger.warning(
                "Fallo de ingesta (intento %s/%s): %s", intento, retries + 1, report.error
            )
            if intento <= retries:
                await sleep(backoff_base * (2 ** (intento - 1)))
                continue
            # Se agotaron los reintentos: ejecución fallida.
            report.latencia_ms = int((time.perf_counter() - inicio) * 1000)
            report.http_status = 0
            return report
        report.latencia_ms = int((time.perf_counter() - inicio) * 1000)
        report.http_status = 200
        break

    if registros is None:
        report.error = report.error or "sin datos"
        return report

    report.leidos = len(registros)
    for raw in registros:
        resultado = normalizer.normalize(raw)
        if not resultado.ok or resultado.event is None:
            report.rechazados += 1
            if resultado.motivo:
                report.motivos_rechazo.append(resultado.motivo)
            continue
        try:
            insertado = await repository.upsert(resultado.event)
        except Exception as exc:  # noqa: BLE001 - se reporta en la ejecución
            logger.exception("Error al persistir el evento %s", resultado.event.external_id)
            report.error = f"Error al persistir: {exc}"
            report.http_status = 206
            return report
        if insertado:
            report.insertados += 1
        else:
            report.duplicados += 1

    return report


__all__ = ["run_sync", "EventRepository", "BACKOFF_BASE_SEG", "MAX_INTENTOS_EXTRA"]
