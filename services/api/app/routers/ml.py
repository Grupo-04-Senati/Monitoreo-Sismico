"""Endpoints del módulo "Modelos de Machine Learning" (6.6).

Pendiente de implementar (Dueño B). Lectura con el permiso `modelos`
(Administrador y Analista). Aprobar un modelo es solo de Administrador y hoy
responde 501: no se finge una aprobación que no ocurrió.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.permissions import require_permission, require_role

router = APIRouter(dependencies=[Depends(require_permission("modelos"))])


@router.get("/experiments")
async def list_experiments():
    return {"items": [], "total": 0}


@router.get("/experiments/{experiment_id}")
async def get_experiment(experiment_id: str):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Experimento no encontrado")


@router.post("/models/{model_id}/approve", dependencies=[Depends(require_role("admin"))])
async def approve_model(model_id: str):
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="La aprobación de modelos aún no está implementada",
    )
