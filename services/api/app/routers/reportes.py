"""Endpoints del módulo "Reportes" (6.11).

- Lectura (listar, ver, tipos): permiso `reportes`.
- Generación: permiso `reportes_generar` (Administrador, Analista, Operador y
  Auditor). El formato PDF exige, además, `reportes_pdf`.
- Descarga: solo el **solicitante** o un Administrador, y el enlace **expira**.

Cada generación y cada descarga quedan registradas en Auditoría.
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.db.database import get_db
from app.db.models import User
from app.schemas.reportes import ReportCreateIn, ReportListOut, ReportOut, ReportTypesOut
from app.services.reports_service import (
    crear_reporte,
    generar_en_background,
    listar_reportes,
    listar_tipos,
    obtener_reporte,
    preparar_descarga,
    serializar_job,
)

router = APIRouter()

_VER = Depends(require_permission("reportes"))
_GENERAR = Depends(require_permission("reportes_generar"))

_MEDIA_TYPES = {
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


def _correlacion(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@router.get("/types", response_model=ReportTypesOut)
async def tipos(
    actor: User = _VER,
) -> ReportTypesOut:
    return ReportTypesOut(items=listar_tipos(actor))


@router.get("", response_model=ReportListOut)
async def listar(
    tipo: str | None = Query(default=None, max_length=32),
    estado: str | None = Query(default=None, max_length=16),
    solicitante: str | None = Query(default=None, max_length=36),
    pagina: int = Query(default=1, ge=1),
    tamano: int = Query(default=10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    actor: User = _VER,
) -> ReportListOut:
    return await listar_reportes(
        db,
        actor,
        tipo=tipo,
        estado=estado,
        solicitante=solicitante,
        pagina=pagina,
        tamano=tamano,
    )


@router.post("", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
async def solicitar(
    payload: ReportCreateIn,
    request: Request,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    actor: User = _GENERAR,
) -> ReportOut:
    job = await crear_reporte(db, actor, payload, correlation_id=_correlacion(request))
    background.add_task(generar_en_background, job.id)
    return serializar_job(job, actor.full_name)


@router.get("/{report_id}", response_model=ReportOut)
async def detalle(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    actor: User = _VER,
) -> ReportOut:
    return await obtener_reporte(db, actor, report_id)


@router.get("/{report_id}/download")
async def descargar(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    actor: User = _VER,
) -> FileResponse:
    ruta, nombre, job = await preparar_descarga(db, actor, report_id)
    return FileResponse(
        path=ruta,
        filename=nombre,
        media_type=_MEDIA_TYPES.get(job.formato, "application/octet-stream"),
    )


__all__ = ["router"]
