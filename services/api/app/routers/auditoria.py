"""Endpoints del módulo "Auditoría" (6.13).

Pendiente de implementar (Dueño B): falta la tabla `audit_logs`. Exige el
permiso `auditoria` (Administrador y Auditor).
"""

from fastapi import APIRouter, Depends

from app.core.permissions import require_permission

router = APIRouter(dependencies=[Depends(require_permission("auditoria"))])


@router.get("")
async def list_audit_logs():
    return {"items": [], "total": 0}
