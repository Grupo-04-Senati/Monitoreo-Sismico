"""Endpoints del módulo "Modelos de Machine Learning" (6.6).

- Consultar y entrenar experimentos: permiso `modelos` (Administrador y Analista).
  Solo se entrena con datasets aprobados.
- Aprobar un modelo: solo Administrador. `{experiment_id}` es el experimento cuyo
  mejor modelo se registra; no se aprueba si el mejor resultado es una referencia.
Las altas y aprobaciones quedan en la auditoría.
"""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission, require_role
from app.db.database import get_db
from app.db.models import MLExperiment, ModelRegistry, User
from app.schemas.ml import (
    TAREAS,
    ApproveModelIn,
    ExperimentCreateIn,
    ExperimentListOut,
    ExperimentOut,
    ModelListOut,
    ModelOut,
)
from app.services import ml_experimentos as servicio

router = APIRouter(dependencies=[Depends(require_permission("modelos"))])

_MODELOS = Depends(require_permission("modelos"))
_ADMIN = Depends(require_role("admin"))


def _correlacion(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _experimento(e: MLExperiment, model_id: str | None) -> ExperimentOut:
    salida = ExperimentOut.model_validate(e)
    salida.model_id = model_id
    return salida


def _modelo(m: ModelRegistry, e: MLExperiment) -> ModelOut:
    return ModelOut(
        id=m.id,
        experiment_id=e.id,
        name=m.name,
        version=m.version,
        status=m.status,
        task_type=e.task_type,
        algorithm=e.algorithm,
        dataset_id=e.dataset_id,
        metrics=(e.metrics or {}).get(e.algorithm or "", {}),
        approved_by=m.approved_by,
        approved_at=m.approved_at,
        limitations=m.limitations,
    )


@router.get("/experiments", response_model=ExperimentListOut)
async def list_experiments(
    estado: Literal["completado", "fallido"] | None = Query(default=None),
    tarea: Literal[TAREAS] | None = Query(default=None),  # type: ignore[valid-type]
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> ExperimentListOut:
    items, total = await servicio.listar(db, estado=estado, tarea=tarea, page=page, page_size=page_size)
    modelos = await servicio.modelos_por_experimento(db, [e.id for e in items])
    return ExperimentListOut(
        items=[_experimento(e, modelos.get(e.id)) for e in items], total=total, page=page, page_size=page_size
    )


@router.post("/experiments", response_model=ExperimentOut, status_code=status.HTTP_201_CREATED)
async def create_experiment(
    payload: ExperimentCreateIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: User = _MODELOS,
) -> ExperimentOut:
    experimento = await servicio.crear(db, actor, payload, correlation_id=_correlacion(request))
    return _experimento(experimento, None)


@router.get("/experiments/{experiment_id}", response_model=ExperimentOut)
async def get_experiment(experiment_id: str, db: AsyncSession = Depends(get_db)) -> ExperimentOut:
    experimento = await servicio.obtener(db, experiment_id)
    modelos = await servicio.modelos_por_experimento(db, [experimento.id])
    return _experimento(experimento, modelos.get(experimento.id))


@router.get("/models", response_model=ModelListOut)
async def list_models(db: AsyncSession = Depends(get_db)) -> ModelListOut:
    filas = await servicio.listar_modelos(db)
    return ModelListOut(items=[_modelo(m, e) for m, e in filas], total=len(filas))


@router.post("/models/{experiment_id}/approve", response_model=ModelOut)
async def approve_model(
    experiment_id: str,
    request: Request,
    payload: ApproveModelIn | None = None,
    db: AsyncSession = Depends(get_db),
    actor: User = _ADMIN,
) -> ModelOut:
    modelo, experimento = await servicio.aprobar(
        db,
        actor,
        experiment_id,
        limitaciones_extra=payload.limitaciones if payload else None,
        correlation_id=_correlacion(request),
    )
    return _modelo(modelo, experimento)
