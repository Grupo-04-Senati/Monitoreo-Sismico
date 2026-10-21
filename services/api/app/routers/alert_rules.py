"""Endpoints del módulo "Reglas de alertas" (6.8).

Pendiente de implementar (Dueño B). Exige el permiso `reglas`
(Administrador y Operador de alertas).
"""

from fastapi import APIRouter, Depends

from app.core.permissions import require_permission

router = APIRouter(dependencies=[Depends(require_permission("reglas"))])


@router.get("")
async def list_alert_rules():
    return {"items": [], "total": 0}
