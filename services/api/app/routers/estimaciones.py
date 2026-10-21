"""Endpoints del módulo "Estimaciones experimentales" (6.7).

- Consultar y generar estimaciones: permiso `estimaciones` (Administrador y Analista).
  Solo un modelo aprobado de conteo semanal las genera.
- Publicar o retirar: solo Administrador. Una estimación nunca se envía como alerta.
Toda respuesta lleva la advertencia; las altas y revisiones quedan en la auditoría.
"""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission, require_role
from app.db.database import get_db
from app.db.models import EstimateStatus, MLExperiment, ModelRegistry, RiskEstimate, User
from app.schemas.estimaciones import EstimateCreateIn, EstimateListOut, EstimateOut
from app.services import estimaciones as servicio

router = APIRouter(dependencies=[Depends(require_permission("estimaciones"))])

_ESTIMAR = Depends(require_permission("estimaciones"))
_ADMIN = Depends(require_role("admin"))


def _correlacion(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _salida(e: RiskEstimate, contexto: tuple[ModelRegistry, MLExperiment] | None) -> EstimateOut:
    datos = {c.name: getattr(e, c.name) for c in RiskEstimate.__table__.columns}
    if contexto:
        modelo, experimento = contexto
        datos.update(model_name=modelo.name, model_version=modelo.version, algorithm=experimento.algorithm)
    return EstimateOut(**datos)


async def _una(db: AsyncSession, e: RiskEstimate) -> EstimateOut:
    contexto = await servicio.modelos_de(db, {e.model_id})
    return _salida(e, contexto.get(e.model_id))


@router.get("", response_model=EstimateListOut)
async def list_estimates(
    estado: Literal["en_revision", "publicada", "retirada"] | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> EstimateListOut:
    items, total = await servicio.listar(db, estado=estado, page=page, page_size=page_size)
    contexto = await servicio.modelos_de(db, {e.model_id for e in items})
    return EstimateListOut(
        items=[_salida(e, contexto.get(e.model_id)) for e in items],
        total=total,
        page=page,
        page_size=page_size,
        disclaimer=servicio.DISCLAIMER,
    )


@router.post("", response_model=EstimateOut, status_code=status.HTTP_201_CREATED)
async def create_estimate(
    payload: EstimateCreateIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: User = _ESTIMAR,
) -> EstimateOut:
    estimacion = await servicio.crear(db, actor, payload.model_id, correlation_id=_correlacion(request))
    return await _una(db, estimacion)


@router.get("/{estimate_id}", response_model=EstimateOut)
async def get_estimate(estimate_id: str, db: AsyncSession = Depends(get_db)) -> EstimateOut:
    return await _una(db, await servicio.obtener(db, estimate_id))


@router.post("/{estimate_id}/publish", response_model=EstimateOut)
async def publish_estimate(
    estimate_id: str, request: Request, db: AsyncSession = Depends(get_db), actor: User = _ADMIN
) -> EstimateOut:
    e = await servicio.revisar(db, actor, estimate_id, EstimateStatus.PUBLICADA, correlation_id=_correlacion(request))
    return await _una(db, e)


@router.post("/{estimate_id}/withdraw", response_model=EstimateOut)
async def withdraw_estimate(
    estimate_id: str, request: Request, db: AsyncSession = Depends(get_db), actor: User = _ADMIN
) -> EstimateOut:
    e = await servicio.revisar(db, actor, estimate_id, EstimateStatus.RETIRADA, correlation_id=_correlacion(request))
    return await _una(db, e)
