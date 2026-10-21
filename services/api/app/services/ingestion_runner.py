"""Sincronización de fuentes: puente entre el motor de ingesta y la base de datos.

Crea la ejecución (`ingestion_runs`), elige el conector de la fuente y persiste los
eventos de forma **idempotente** mediante `INSERT ... ON CONFLICT DO NOTHING`
sobre `(source_id, external_id)`. Al terminar actualiza la ejecución y escribe el
registro (`ingestion_logs`). Repetir una sincronización no duplica registros.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now

from app.db.database import AsyncSessionLocal
from app.db.models import DataSource, IngestionLog, IngestionRun, RunStatus, SeismicEvent
from app.services.ingestion_bridge import (
    NormalizedEvent,
    SyncReport,
    crear_pipeline,
    run_sync,
)

#: Evita lanzar dos sincronizaciones simultáneas sobre la misma fuente.
COOLDOWN_SEG = 30


class RepositorioEventos:
    """Repositorio de eventos sobre Postgres, idempotente por (source_id, external_id)."""

    def __init__(self, db: AsyncSession, source_id: str) -> None:
        self.db = db
        self.source_id = source_id

    async def upsert(self, event: NormalizedEvent) -> bool:
        stmt = (
            pg_insert(SeismicEvent)
            .values(
                id=str(uuid.uuid4()),
                source_id=self.source_id,
                external_id=event.external_id,
                occurred_at=event.occurred_at,
                received_at=event.received_at,
                latitude=event.latitude,
                longitude=event.longitude,
                depth_km=event.depth_km,
                magnitude=event.magnitude,
                magnitude_type=event.magnitude_type,
                region=event.region,
                locality=event.locality,
                source_url=event.source_url,
                review_status=event.review_status,
                origin_hash=event.origin_hash,
                raw_payload=event.raw,
            )
            .on_conflict_do_nothing(index_elements=["source_id", "external_id"])
        )
        result = await self.db.execute(stmt)
        return result.rowcount == 1


async def obtener_fuente(db: AsyncSession, id_o_key: str) -> DataSource | None:
    stmt = select(DataSource).where(
        or_(DataSource.id == id_o_key, DataSource.key == id_o_key)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def esta_en_cooldown(
    db: AsyncSession, source_id: str, cooldown_seg: int = COOLDOWN_SEG
) -> bool:
    desde = clock_now() - timedelta(seconds=cooldown_seg)
    stmt = (
        select(func.count())
        .select_from(IngestionRun)
        .where(
            IngestionRun.source_id == source_id,
            IngestionRun.status == RunStatus.EN_CURSO,
            IngestionRun.started_at >= desde,
        )
    )
    return int((await db.execute(stmt)).scalar_one()) > 0


async def iniciar_ejecucion(
    db: AsyncSession,
    source: DataSource,
    *,
    triggered_by: str,
    actor_id: str | None,
    correlation_id: str | None,
) -> IngestionRun:
    run = IngestionRun(
        id=str(uuid.uuid4()),
        source_id=source.id,
        status=RunStatus.EN_CURSO,
        triggered_by=triggered_by,
        started_at=clock_now(),
        correlation_id=correlation_id,
        actor_id=actor_id,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run


async def _marca_incremental(db: AsyncSession, source_id: str) -> datetime | None:
    """Desde cuándo leer: fin de la última ejecución finalizada."""
    stmt = select(func.max(IngestionRun.finished_at)).where(
        IngestionRun.source_id == source_id,
        IngestionRun.status != RunStatus.EN_CURSO,
    )
    return (await db.execute(stmt)).scalar_one_or_none()


def _resumen_error(report: SyncReport) -> str | None:
    if report.error:
        return report.error
    if report.rechazados:
        return f"{report.rechazados} registro(s) inválidos omitidos."
    return None


def _registrar_logs(db: AsyncSession, run: IngestionRun, report: SyncReport) -> None:
    base = {"source_id": run.source_id, "run_id": run.id, "correlation_id": run.correlation_id}
    if report.error:
        db.add(IngestionLog(ts=clock_now(), level="ERROR", message=report.error[:500], **base))
        if report.intentos > 1:
            db.add(
                IngestionLog(
                    ts=clock_now(),
                    level="WARN",
                    message=f"Se agotaron {report.intentos} intentos con backoff.",
                    **base,
                )
            )
        return
    if report.rechazados:
        motivos = "; ".join(sorted(set(report.motivos_rechazo))) or "datos inválidos"
        db.add(
            IngestionLog(
                ts=clock_now(),
                level="WARN",
                message=f"{report.rechazados} registro(s) inválidos omitidos ({motivos})."[:500],
                **base,
            )
        )
    db.add(
        IngestionLog(
            ts=clock_now(),
            level="INFO",
            message=(
                f"Ingesta {report.estado}: {report.insertados} insertados, "
                f"{report.duplicados} duplicados omitidos de {report.leidos} leídos."
            )[:500],
            **base,
        )
    )
    for motivo in sorted(set(report.motivos_rechazo)):
        db.add(
            IngestionLog(
                ts=clock_now(),
                level="WARN",
                message=f"Registro omitido: {motivo}."[:500],
                **base,
            )
        )


async def finalizar_ejecucion(db: AsyncSession, run: IngestionRun, report: SyncReport) -> IngestionRun:
    ahora = clock_now()
    run.finished_at = ahora
    run.duration_ms = int((ahora - run.started_at).total_seconds() * 1000)
    run.latency_ms = report.latencia_ms
    run.http_status = report.http_status
    run.records_read = report.leidos
    run.records_inserted = report.insertados
    run.duplicates_skipped = report.duplicados
    run.attempts = report.intentos
    run.status = report.estado
    run.error_summary = _resumen_error(report)
    _registrar_logs(db, run, report)
    await db.commit()
    await db.refresh(run)
    return run


async def sincronizar(
    db: AsyncSession,
    source: DataSource,
    run: IngestionRun,
    *,
    correlation_id: str | None = None,
    desde: datetime | None = None,
    timeout_sec: int | None = None,
) -> IngestionRun:
    """Ejecuta la sincronización completa (conector → normalizador → BD).

    `desde` fuerza el inicio (carga histórica); por defecto se continúa desde la
    última ejecución. `timeout_sec` permite más tiempo para cargas grandes.
    """
    since = desde or await _marca_incremental(db, source.id)
    timeout = timeout_sec or source.timeout_sec
    repo = RepositorioEventos(db, source.id)
    connector, normalizer = crear_pipeline(
        source.key, url_api=source.url_api, timeout_sec=timeout, ahora=clock_now
    )
    try:
        report = await run_sync(
            connector=connector,
            normalizer=normalizer,
            repository=repo,
            since=since,
            retries=source.retries,
            timeout_sec=timeout,
        )
    except Exception as exc:  # noqa: BLE001 - nunca dejar la ejecución colgada
        report = SyncReport(error=f"Error inesperado: {exc}", http_status=0)
    return await finalizar_ejecucion(db, run, report)


async def ejecutar_sincronizacion(
    source_id: str,
    *,
    run_id: str | None = None,
    triggered_by: str = "scheduled",
    actor_id: str | None = None,
    correlation_id: str | None = None,
    desde: datetime | None = None,
    timeout_sec: int | None = None,
) -> str:
    """Punto de entrada asíncrono (Celery / tarea en segundo plano).

    Abre su propia sesión de base de datos y devuelve el id de la ejecución.
    """
    async with AsyncSessionLocal() as db:
        source = await obtener_fuente(db, source_id)
        if source is None:
            # Fuente inexistente: no hay nada que sincronizar.
            return run_id or ""

        run = await db.get(IngestionRun, run_id) if run_id else None
        if run is None:
            run = await iniciar_ejecucion(
                db,
                source,
                triggered_by=triggered_by,
                actor_id=actor_id,
                correlation_id=correlation_id,
            )

        run = await sincronizar(
            db, source, run, correlation_id=correlation_id, desde=desde, timeout_sec=timeout_sec
        )
        return run.id


async def sincronizar_todas(*, triggered_by: str = "scheduled") -> list[str]:
    """Sincroniza todas las fuentes habilitadas (usado por Celery beat)."""
    async with AsyncSessionLocal() as db:
        fuentes = list(
            (
                await db.execute(select(DataSource).where(DataSource.enabled.is_(True)))
            ).scalars().all()
        )
    ids: list[str] = []
    for source in fuentes:
        ids.append(await ejecutar_sincronizacion(source.id, triggered_by=triggered_by))
    return ids


__all__ = [
    "COOLDOWN_SEG",
    "RepositorioEventos",
    "obtener_fuente",
    "esta_en_cooldown",
    "iniciar_ejecucion",
    "finalizar_ejecucion",
    "sincronizar",
    "ejecutar_sincronizacion",
    "sincronizar_todas",
]
