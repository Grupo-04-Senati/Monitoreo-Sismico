"""Análisis estadístico: serie temporal y resumen (módulo 6.7).

Los cálculos se hacen en SQL real (`app.services.analytics`) con los mismos
filtros que el listado de eventos. Requiere el permiso `analisis`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.db.database import get_db
from app.db.models import User
from app.services.analytics import resumen_estadistico, serie_temporal

router = APIRouter()

_VER = Depends(require_permission("analisis"))


@router.get("/timeseries")
async def timeseries(
    agrupacion: str = Query(default="dia", pattern="^(dia|semana|mes|hora)$"),
    desde: str | None = Query(default=None, alias="from", max_length=40),
    hasta: str | None = Query(default=None, alias="to", max_length=40),
    mag_min: float | None = Query(default=None, ge=0, le=10),
    mag_max: float | None = Query(default=None, ge=0, le=10),
    mag_type: str | None = Query(default=None),
    depth_min: float | None = Query(default=None, ge=0, le=750),
    depth_max: float | None = Query(default=None, ge=0, le=750),
    region: str | None = Query(default=None, max_length=64),
    review_status: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=80),
    db: AsyncSession = Depends(get_db),
    actor: User = _VER,
) -> dict:
    return await serie_temporal(
        db,
        agrupacion=agrupacion,
        desde=desde,
        hasta=hasta,
        mag_min=mag_min,
        mag_max=mag_max,
        mag_type=mag_type,
        depth_min=depth_min,
        depth_max=depth_max,
        region=region,
        review_status=review_status,
        q=q,
    )


@router.get("/summary")
async def summary(
    desde: str | None = Query(default=None, alias="from", max_length=40),
    hasta: str | None = Query(default=None, alias="to", max_length=40),
    mag_min: float | None = Query(default=None, ge=0, le=10),
    mag_max: float | None = Query(default=None, ge=0, le=10),
    mag_type: str | None = Query(default=None),
    depth_min: float | None = Query(default=None, ge=0, le=750),
    depth_max: float | None = Query(default=None, ge=0, le=750),
    region: str | None = Query(default=None, max_length=64),
    review_status: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=80),
    db: AsyncSession = Depends(get_db),
    actor: User = _VER,
) -> dict:
    return await resumen_estadistico(
        db,
        desde=desde,
        hasta=hasta,
        mag_min=mag_min,
        mag_max=mag_max,
        mag_type=mag_type,
        depth_min=depth_min,
        depth_max=depth_max,
        region=region,
        review_status=review_status,
        q=q,
    )
