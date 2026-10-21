"""Endpoint del estado operativo (PDF §12, Fase 9). Solo Administrador (permiso
`configuracion`): ingesta, ejecuciones, avisos, latencia, base y copias."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.db.database import get_db
from app.services import monitoreo

router = APIRouter(dependencies=[Depends(require_permission("configuracion"))])


class ComprobacionOut(BaseModel):
    clave: str
    nombre: str
    estado: str
    detalle: str
    datos: dict[str, Any]


class EstadoOut(BaseModel):
    estado: str
    generado_en: datetime
    comprobaciones: list[ComprobacionOut]


@router.get("", response_model=EstadoOut)
async def system_status(db: AsyncSession = Depends(get_db)) -> EstadoOut:
    return EstadoOut(**await monitoreo.estado(db))
