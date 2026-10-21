"""Endpoints del módulo "Preparación de datos" (6.5).

- Consultar y crear datasets: permiso `preparacion` (Administrador y Analista).
- Aprobar un dataset: solo Administrador. Un dataset aprobado es inmutable; para
  cambiarlo se crea una nueva versión con el mismo nombre.
Las altas y aprobaciones quedan en la auditoría.
"""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission, require_role
from app.db.database import get_db
from app.db.models import User
from app.schemas.datasets import (
    DatasetCreateIn,
    DatasetListOut,
    DatasetOut,
    DatasetQualityOut,
    DatasetRowOut,
    DatasetRowsOut,
)
from app.services import datasets as servicio

router = APIRouter(dependencies=[Depends(require_permission("preparacion"))])

_PREPARAR = Depends(require_permission("preparacion"))
_ADMIN = Depends(require_role("admin"))


def _correlacion(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@router.get("", response_model=DatasetListOut)
async def list_datasets(
    name: str | None = Query(default=None, max_length=120),
    estado: Literal["borrador", "aprobado"] | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> DatasetListOut:
    items, total = await servicio.listar(db, nombre=name, estado=estado, page=page, page_size=page_size)
    return DatasetListOut(
        items=[DatasetOut.model_validate(d) for d in items], total=total, page=page, page_size=page_size
    )


@router.post("", response_model=DatasetOut, status_code=status.HTTP_201_CREATED)
async def create_dataset(
    payload: DatasetCreateIn,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: User = _PREPARAR,
) -> DatasetOut:
    dataset = await servicio.crear(db, actor, payload, correlation_id=_correlacion(request))
    return DatasetOut.model_validate(dataset)


@router.get("/{dataset_id}", response_model=DatasetOut)
async def get_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)) -> DatasetOut:
    return DatasetOut.model_validate(await servicio.obtener(db, dataset_id))


@router.get("/{dataset_id}/quality", response_model=DatasetQualityOut)
async def dataset_quality(dataset_id: str, db: AsyncSession = Depends(get_db)) -> DatasetQualityOut:
    d = await servicio.obtener(db, dataset_id)
    return DatasetQualityOut(
        dataset_id=d.id, name=d.name, version=d.version, status=d.status, quality_report=d.quality_report
    )


@router.get("/{dataset_id}/rows", response_model=DatasetRowsOut)
async def dataset_rows(
    dataset_id: str,
    split: Literal["entrenamiento", "prueba"] | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> DatasetRowsOut:
    dataset = await servicio.obtener(db, dataset_id)
    items, total = await servicio.filas(db, dataset, split=split, page=page, page_size=page_size)
    return DatasetRowsOut(
        items=[DatasetRowOut(**i) for i in items], total=total, page=page, page_size=page_size
    )


@router.post("/{dataset_id}/approve", response_model=DatasetOut)
async def approve_dataset(
    dataset_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    actor: User = _ADMIN,
) -> DatasetOut:
    dataset = await servicio.aprobar(db, actor, dataset_id, correlation_id=_correlacion(request))
    return DatasetOut.model_validate(dataset)
