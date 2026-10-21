"""Experimentos de ML y registro de modelos (PDF §6.6, §7 y §10).

Un experimento se entrena siempre sobre un dataset **aprobado** (inmutable), con
sus eventos congelados (`dataset_events`), su partición y su imputación. Se
guarda todo lo necesario para reproducirlo, y el modelo entrenado como artefacto.
Un experimento fallido también se guarda, con su motivo.

Aprobar un experimento lo registra en `model_registry` (solo Administrador):
únicamente un modelo aprobado podrá publicar estimaciones experimentales.
"""

from __future__ import annotations

import asyncio
import uuid

import joblib
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now
from app.db.models import (
    Dataset,
    DatasetEvent,
    DatasetStatus,
    ExperimentStatus,
    MLExperiment,
    ModelRegistry,
    SeismicEvent,
    User,
)
from app.schemas.ml import ExperimentCreateIn
from app.services import revisiones
from app.services.audit import registrar_auditoria
from app.services.ml_bridge import (
    ErrorEntrenamiento,
    Resultado,
    carpeta_artefactos,
    conteo_semanal,
    regresion_lineal,
    versiones,
)

REFERENCIAS = {"referencia_media", "referencia_semana_anterior"}


async def _filas_dataset(db: AsyncSession, dataset: Dataset) -> list[dict]:
    """Eventos congelados del dataset con su partición y la imputación aplicada."""
    imputacion = (dataset.quality_report or {}).get("imputacion", {})
    valor = imputacion.get("valor") if imputacion.get("metodo") == "mediana" else None
    resultado = (
        await db.execute(
            select(DatasetEvent.split, SeismicEvent)
            .join(SeismicEvent, SeismicEvent.id == DatasetEvent.event_id)
            .where(DatasetEvent.dataset_id == dataset.id)
            .order_by(SeismicEvent.occurred_at)
        )
    ).all()
    # Valores tal como eran al crear el dataset: las correcciones posteriores de la
    # fuente no cambian lo que se congeló (D27).
    antes = await revisiones.valores_a_la_fecha(db, [e.id for _, e in resultado], dataset.created_at)
    filas = []
    for split, e in resultado:
        profundidad = revisiones.valor(e, "depth_km", antes)
        filas.append(
            {
                "split": split,
                "occurred_at": revisiones.valor(e, "occurred_at", antes),
                "latitude": revisiones.valor(e, "latitude", antes),
                "longitude": revisiones.valor(e, "longitude", antes),
                "depth_km": valor if profundidad is None and valor is not None else profundidad,
                "magnitude": revisiones.valor(e, "magnitude", antes),
                "magnitude_type": revisiones.valor(e, "magnitude_type", antes),
            }
        )
    return sorted(filas, key=lambda f: f["occurred_at"])


def _entrenar(tarea: str, dataset: Dataset, filas: list[dict], semilla: int) -> Resultado:
    if tarea == conteo_semanal.TAREA:
        return conteo_semanal.entrenar(
            [f["occurred_at"] for f in filas],
            inicio=dataset.period_start,
            fin=dataset.period_end,
            fecha_corte=dataset.split_date,
            semilla=semilla,
        )
    return regresion_lineal.entrenar(
        filas, variables=list(dataset.variables), objetivo=dataset.target_name, semilla=semilla
    )


async def crear(
    db: AsyncSession, actor: User, payload: ExperimentCreateIn, *, correlation_id: str | None = None
) -> MLExperiment:
    dataset = await db.get(Dataset, payload.dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset no encontrado")
    if dataset.status != DatasetStatus.APROBADO:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se entrena con datasets aprobados (inmutables): apruebe el dataset primero.",
        )

    filas = await _filas_dataset(db, dataset)
    experimento = MLExperiment(
        # El id se fija aquí: el artefacto se nombra con él y el experimento se
        # guarda en una sola inserción (la tabla no admite UPDATE).
        id=str(uuid.uuid4()),
        name=payload.name,
        task_type=payload.task_type,
        dataset_id=dataset.id,
        seed=payload.semilla,
        library_versions=versiones(),
        params={"semilla": payload.semilla, "dataset": f"{dataset.name} v{dataset.version}"},
        created_by=actor.id,
    )
    try:
        # scikit-learn es síncrono: se entrena fuera del bucle de eventos.
        resultado = await asyncio.to_thread(_entrenar, payload.task_type, dataset, filas, payload.semilla)
    except ErrorEntrenamiento as exc:
        experimento.status = ExperimentStatus.FALLIDO
        experimento.error = str(exc)[:500]
        experimento.feature_spec = list(dataset.variables)
        experimento.target_name = dataset.target_name
    else:
        experimento.status = ExperimentStatus.COMPLETADO
        experimento.algorithm = resultado.mejor
        experimento.feature_spec = resultado.variables
        experimento.target_name = resultado.objetivo
        experimento.metrics = resultado.metricas
        experimento.validation_spec = resultado.validacion
        experimento.results = {
            "mejora": resultado.mejora,
            "coeficientes": resultado.coeficientes,
            "serie_prueba": resultado.serie_prueba,
        }
        experimento.warnings = resultado.advertencias
        experimento.limitations = resultado.limitaciones

    artefacto = None
    if experimento.status == ExperimentStatus.COMPLETADO:
        nombre = f"{experimento.id}.joblib"
        artefacto = carpeta_artefactos() / nombre
        await asyncio.to_thread(
            joblib.dump,
            {
                "experimento_id": experimento.id,
                "tarea": experimento.task_type,
                "dataset_id": dataset.id,
                "variables": experimento.feature_spec,
                "objetivo": experimento.target_name,
                "mejor": experimento.algorithm,
                "modelos": resultado.modelos,
                "versiones": experimento.library_versions,
            },
            artefacto,
        )
        experimento.artifact_uri = nombre
    db.add(experimento)
    try:
        await db.commit()
    except Exception:
        if artefacto is not None:
            artefacto.unlink(missing_ok=True)  # sin experimento, el archivo no debe quedar
        raise
    await db.refresh(experimento)

    registrar_auditoria(
        actor_id=actor.id,
        action="ml_experimento_creado",
        entity_type="ml_experiment",
        entity_id=experimento.id,
        after={
            "name": experimento.name,
            "task_type": experimento.task_type,
            "dataset_id": dataset.id,
            "status": experimento.status,
            "algorithm": experimento.algorithm,
        },
        correlation_id=correlation_id,
    )
    return experimento


async def obtener(db: AsyncSession, experiment_id: str) -> MLExperiment:
    experimento = await db.get(MLExperiment, experiment_id)
    if experimento is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experimento no encontrado")
    return experimento


async def modelos_por_experimento(db: AsyncSession, ids: list[str]) -> dict[str, str]:
    if not ids:
        return {}
    filas = await db.execute(
        select(ModelRegistry.experiment_id, ModelRegistry.id).where(ModelRegistry.experiment_id.in_(ids))
    )
    return dict(filas.all())


async def listar(
    db: AsyncSession, *, estado: str | None, tarea: str | None, page: int, page_size: int
) -> tuple[list[MLExperiment], int]:
    filtros = []
    if estado:
        filtros.append(MLExperiment.status == estado)
    if tarea:
        filtros.append(MLExperiment.task_type == tarea)
    total = await db.scalar(select(func.count()).select_from(MLExperiment).where(*filtros)) or 0
    items = (
        await db.execute(
            select(MLExperiment)
            .where(*filtros)
            .order_by(MLExperiment.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return list(items), total


async def aprobar(
    db: AsyncSession,
    actor: User,
    experiment_id: str,
    *,
    limitaciones_extra: str | None,
    correlation_id: str | None = None,
) -> tuple[ModelRegistry, MLExperiment]:
    experimento = await obtener(db, experiment_id)
    if experimento.status != ExperimentStatus.COMPLETADO:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se aprueba un experimento completado.")
    if experimento.algorithm in REFERENCIAS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El mejor resultado es una referencia, no un modelo: no hay modelo que aprobar.",
        )
    ya = await db.scalar(select(ModelRegistry.id).where(ModelRegistry.experiment_id == experimento.id))
    if ya:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este experimento ya tiene un modelo aprobado.")

    version = (
        await db.scalar(select(func.max(ModelRegistry.version)).where(ModelRegistry.name == experimento.name)) or 0
    ) + 1
    texto = list(experimento.limitations)
    if limitaciones_extra and limitaciones_extra.strip():
        texto.append(limitaciones_extra.strip())
    modelo = ModelRegistry(
        experiment_id=experimento.id,
        name=experimento.name,
        version=version,
        status="aprobado",
        approved_by=actor.id,
        approved_at=clock_now(),
        limitations="\n".join(texto)[:2000],
    )
    db.add(modelo)
    await db.commit()
    await db.refresh(modelo)
    registrar_auditoria(
        actor_id=actor.id,
        action="ml_modelo_aprobado",
        entity_type="model_registry",
        entity_id=modelo.id,
        after={"experiment_id": experimento.id, "name": modelo.name, "version": modelo.version},
        correlation_id=correlation_id,
    )
    return modelo, experimento


async def listar_modelos(db: AsyncSession) -> list[tuple[ModelRegistry, MLExperiment]]:
    filas = await db.execute(
        select(ModelRegistry, MLExperiment)
        .join(MLExperiment, MLExperiment.id == ModelRegistry.experiment_id)
        .order_by(ModelRegistry.approved_at.desc())
    )
    return list(filas.all())


__all__ = ["crear", "obtener", "listar", "aprobar", "listar_modelos", "modelos_por_experimento"]
