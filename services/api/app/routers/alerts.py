"""Endpoints del módulo "Centro de alertas" (6.9).

Pendiente de implementar (Dueño B). Exige el permiso `alertas`
(Administrador y Operador de alertas). Aprobar una alerta hoy responde 501:
no se finge una aprobación que no ocurrió.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.permissions import require_permission

router = APIRouter(dependencies=[Depends(require_permission("alertas"))])


@router.get("")
async def list_alerts():
    return {"items": [], "total": 0}


@router.post("/{alert_id}/approve")
async def approve_alert(alert_id: str):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="La aprobación de alertas aún no está implementada",
    )
