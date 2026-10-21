"""Endpoints del módulo "Auditoría" (6.13).

Consulta de la bitácora `audit_logs` (solo lectura; la tabla es de solo
inserción). Exige el permiso `auditoria` (Administrador y Auditor).
Pendiente: retención configurable y exportación auditada (módulo Configuración).
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.db.database import get_db
from app.db.models import AuditLog
from app.schemas.auditoria import AuditLogListOut, AuditLogOut

router = APIRouter(dependencies=[Depends(require_permission("auditoria"))])


@router.get("", response_model=AuditLogListOut)
async def list_audit_logs(
    actor_id: str | None = Query(default=None, max_length=36),
    action: str | None = Query(default=None, max_length=64),
    entity_type: str | None = Query(default=None, max_length=64),
    entity_id: str | None = Query(default=None, max_length=64),
    desde: datetime | None = Query(default=None, alias="from"),
    hasta: datetime | None = Query(default=None, alias="to"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> AuditLogListOut:
    filtros = []
    if actor_id:
        filtros.append(AuditLog.actor_id == actor_id)
    if action:
        filtros.append(AuditLog.action == action)
    if entity_type:
        filtros.append(AuditLog.entity_type == entity_type)
    if entity_id:
        filtros.append(AuditLog.entity_id == entity_id)
    if desde:
        filtros.append(AuditLog.occurred_at >= desde)
    if hasta:
        filtros.append(AuditLog.occurred_at <= hasta)

    total = await db.scalar(select(func.count()).select_from(AuditLog).where(*filtros)) or 0
    filas = (
        await db.execute(
            select(AuditLog)
            .where(*filtros)
            .order_by(AuditLog.occurred_at.desc(), AuditLog.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    return AuditLogListOut(
        items=[AuditLogOut.model_validate(f) for f in filas],
        total=total,
        page=page,
        page_size=page_size,
    )
