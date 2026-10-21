"""Datasets versionados: creación, consulta y aprobación (PDF §6.5 y §7).

Crear un dataset consulta el catálogo con el periodo y la fuente indicados,
aplica las reglas (`calidad_datos.preparar`) y guarda en una sola transacción el
dataset y la lista exacta de eventos (`dataset_events`). La versión se numera
por nombre. Aprobar lo vuelve inmutable (trigger en la base).
"""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, time, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now
from app.db.models import DataSource, Dataset, DatasetEvent, DatasetStatus, SeismicEvent, User
from app.schemas.datasets import DatasetCreateIn
from app.services.audit import registrar_auditoria
from app.services.calidad_datos import FilaEvento, Reglas, preparar


def _inicio_dia(d) -> datetime:  # noqa: ANN001
    return datetime.combine(d, time.min, tzinfo=timezone.utc)


async def obtener(db: AsyncSession, dataset_id: str) -> Dataset:
    dataset = await db.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset no encontrado")
    return dataset


async def crear(
    db: AsyncSession, actor: User, payload: DatasetCreateIn, *, correlation_id: str | None = None
) -> Dataset:
    fuente_id: str | None = None
    if payload.fuente:
        fuente_id = (
            await db.execute(select(DataSource.id).where(DataSource.key == payload.fuente))
        ).scalar_one_or_none()
        if fuente_id is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fuente no encontrada")

    inicio = _inicio_dia(payload.desde)
    fin_exclusivo = _inicio_dia(payload.hasta) + timedelta(days=1)
    consulta = select(SeismicEvent).where(
        SeismicEvent.occurred_at >= inicio, SeismicEvent.occurred_at < fin_exclusivo
    )
    if fuente_id:
        consulta = consulta.where(SeismicEvent.source_id == fuente_id)
    eventos = (await db.execute(consulta)).scalars().all()

    filas = [
        FilaEvento(
            id=e.id,
            occurred_at=e.occurred_at,
            latitude=e.latitude,
            longitude=e.longitude,
            depth_km=e.depth_km,
            magnitude=e.magnitude,
            magnitude_type=e.magnitude_type,
            review_status=e.review_status,
            origin_hash=e.origin_hash,
            region=e.region,
            locality=e.locality,
            source_url=e.source_url,
        )
        for e in eventos
    ]
    reglas = Reglas(**payload.reglas.model_dump())
    corte = _inicio_dia(payload.fecha_corte) if payload.fecha_corte else None
    resultado = preparar(filas, reglas, periodo=(inicio, fin_exclusivo - timedelta(microseconds=1)), fecha_corte=corte)
    if not resultado.filas:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Con ese periodo y esas reglas no queda ningún evento.",
        )

    version = (
        await db.scalar(select(func.max(Dataset.version)).where(Dataset.name == payload.name)) or 0
    ) + 1
    dataset = Dataset(
        name=payload.name,
        version=version,
        description=payload.description,
        status=DatasetStatus.BORRADOR,
        source_id=fuente_id,
        period_start=inicio,
        period_end=fin_exclusivo - timedelta(microseconds=1),
        query_spec={
            "fuente": payload.fuente,
            "desde": payload.desde.isoformat(),
            "hasta": payload.hasta.isoformat(),
        },
        cleaning_rules=asdict(reglas),
        variables=list(payload.variables),
        target_name=payload.variable_objetivo,
        split_date=corte,
        row_count=len(resultado.filas),
        quality_report=resultado.informe,
        created_by=actor.id,
    )
    db.add(dataset)
    await db.flush()
    await db.execute(
        insert(DatasetEvent),
        [{"dataset_id": dataset.id, "event_id": eid, "split": split} for eid, split in resultado.filas],
    )
    await db.commit()
    await db.refresh(dataset)

    registrar_auditoria(
        actor_id=actor.id,
        action="dataset_creado",
        entity_type="dataset",
        entity_id=dataset.id,
        after={"name": dataset.name, "version": dataset.version, "row_count": dataset.row_count},
        correlation_id=correlation_id,
    )
    return dataset


async def aprobar(
    db: AsyncSession, actor: User, dataset_id: str, *, correlation_id: str | None = None
) -> Dataset:
    dataset = await obtener(db, dataset_id)
    if dataset.status == DatasetStatus.APROBADO:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El dataset ya está aprobado")
    dataset.status = DatasetStatus.APROBADO
    dataset.approved_by = actor.id
    dataset.approved_at = clock_now()
    await db.commit()
    await db.refresh(dataset)
    registrar_auditoria(
        actor_id=actor.id,
        action="dataset_aprobado",
        entity_type="dataset",
        entity_id=dataset.id,
        before={"status": DatasetStatus.BORRADOR},
        after={"status": dataset.status, "name": dataset.name, "version": dataset.version},
        correlation_id=correlation_id,
    )
    return dataset


async def listar(
    db: AsyncSession, *, nombre: str | None, estado: str | None, page: int, page_size: int
) -> tuple[list[Dataset], int]:
    filtros = []
    if nombre:
        filtros.append(Dataset.name == nombre)
    if estado:
        filtros.append(Dataset.status == estado)
    total = await db.scalar(select(func.count()).select_from(Dataset).where(*filtros)) or 0
    items = (
        await db.execute(
            select(Dataset)
            .where(*filtros)
            .order_by(Dataset.created_at.desc(), Dataset.version.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return list(items), total


async def filas(
    db: AsyncSession, dataset: Dataset, *, split: str | None, page: int, page_size: int
) -> tuple[list[dict], int]:
    """Vista previa: eventos del dataset con la imputación aplicada y marcada."""
    filtros = [DatasetEvent.dataset_id == dataset.id]
    if split:
        filtros.append(DatasetEvent.split == split)
    total = await db.scalar(select(func.count()).select_from(DatasetEvent).where(*filtros)) or 0
    resultado = (
        await db.execute(
            select(DatasetEvent.split, SeismicEvent)
            .join(SeismicEvent, SeismicEvent.id == DatasetEvent.event_id)
            .where(*filtros)
            .order_by(SeismicEvent.occurred_at, SeismicEvent.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    imputacion = (dataset.quality_report or {}).get("imputacion", {})
    valor = imputacion.get("valor") if imputacion.get("metodo") == "mediana" else None
    items = []
    for split_fila, e in resultado:
        imputada = e.depth_km is None and valor is not None
        items.append(
            {
                "event_id": e.id,
                "external_id": e.external_id,
                "split": split_fila,
                "occurred_at": e.occurred_at,
                "latitude": e.latitude,
                "longitude": e.longitude,
                "depth_km": valor if imputada else e.depth_km,
                "depth_imputada": imputada,
                "magnitude": e.magnitude,
                "magnitude_type": e.magnitude_type,
                "review_status": e.review_status,
            }
        )
    return items, total


__all__ = ["crear", "aprobar", "listar", "obtener", "filas"]
