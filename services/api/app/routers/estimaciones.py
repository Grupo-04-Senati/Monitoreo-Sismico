"""Endpoints del módulo "Estimaciones experimentales" (6.7).

Pendiente de implementar (Dueño B). Exige el permiso `estimaciones`
(Administrador y Analista). Toda respuesta lleva la advertencia: una
estimación nunca equivale a una alerta oficial.
"""

from fastapi import APIRouter, Depends

from app.core.permissions import require_permission

router = APIRouter(dependencies=[Depends(require_permission("estimaciones"))])


@router.get("")
async def list_estimates():
    return {"items": [], "total": 0, "disclaimer": "Estimaciones experimentales. No equivalen a alertas oficiales."}
