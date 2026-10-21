"""Endpoints del módulo "Preparación de datos" (6.5).

Pendiente de implementar (Dueño B). Mientras tanto, las rutas exigen sesión y
el permiso `preparacion` (Administrador y Analista), y no inventan datos: la
lista sale vacía y un dataset que no existe responde 404.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.permissions import require_permission

router = APIRouter(dependencies=[Depends(require_permission("preparacion"))])


@router.get("")
async def list_datasets():
    return {"items": [], "total": 0}


@router.get("/{dataset_id}/quality")
async def dataset_quality(dataset_id: str):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset no encontrado")
