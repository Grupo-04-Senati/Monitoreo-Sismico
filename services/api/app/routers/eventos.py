"""Endpoints del módulo "Eventos sísmicos" (6.2).

Catálogo de eventos observados. **Todos los roles** pueden leerlo; la exportación
se realiza desde el módulo de Reportes. Los registros son observaciones que el
proveedor puede revisar o corregir: no son alertas oficiales ni predicciones.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.db.database import get_db
from app.db.models import User
from app.schemas.eventos import EventDetailOut, EventGeoJSONOut, EventListOut
from app.services.events import listar_eventos, listar_eventos_geojson, obtener_evento

router = APIRouter()

_VER = Depends(require_permission("eventos"))
_VER_MAPA = Depends(require_permission("mapa"))


@router.get("", response_model=EventListOut)
async def listar(
    desde: str | None = Query(default=None, alias="from", max_length=40),
    hasta: str | None = Query(default=None, alias="to", max_length=40),
    mag_min: float | None = Query(default=None, ge=0, le=10),
    mag_max: float | None = Query(default=None, ge=0, le=10),
    mag_type: Literal["Mw", "ML", "mb", "none"] | None = Query(default=None),
    depth_min: float | None = Query(default=None, ge=0, le=750),
    depth_max: float | None = Query(default=None, ge=0, le=750),
    region: str | None = Query(default=None, max_length=64),
    review_status: Literal["observado", "pendiente_validacion"] | None = Query(default=None),
    q: str | None = Query(default=None, max_length=80),
    sort: str = Query(default="-occurred_at", max_length=32),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = _VER,
) -> EventListOut:
    return await listar_eventos(
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
        sort=sort,
        page=page,
        page_size=page_size,
    )


@router.get("/geojson", response_model=EventGeoJSONOut)
async def geojson(
    desde: str | None = Query(default=None, alias="from", max_length=40),
    hasta: str | None = Query(default=None, alias="to", max_length=40),
    mag_min: float | None = Query(default=None, ge=0, le=10),
    mag_max: float | None = Query(default=None, ge=0, le=10),
    mag_type: Literal["Mw", "ML", "mb", "none"] | None = Query(default=None),
    depth_min: float | None = Query(default=None, ge=0, le=750),
    depth_max: float | None = Query(default=None, ge=0, le=750),
    region: str | None = Query(default=None, max_length=64),
    review_status: Literal["observado", "pendiente_validacion"] | None = Query(default=None),
    q: str | None = Query(default=None, max_length=80),
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, gt=0, le=2000),
    bbox: str | None = Query(default=None, max_length=120, description="min_lon,min_lat,max_lon,max_lat"),
    db: AsyncSession = Depends(get_db),
    _: User = _VER_MAPA,
) -> EventGeoJSONOut:
    """Puntos de eventos para el mapa (módulo 6.3).

    Devuelve una `FeatureCollection` con las propiedades que dibuja el mapa.
    El polígono libre queda para una fase posterior.
    """
    return await listar_eventos_geojson(
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
        lat=lat,
        lon=lon,
        radius_km=radius_km,
        bbox=bbox,
    )


@router.get("/{event_id}", response_model=EventDetailOut)
async def detalle(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = _VER,
) -> EventDetailOut:
    evento = await obtener_evento(db, event_id)
    if evento is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evento no encontrado")
    return EventDetailOut(**evento.model_dump())
