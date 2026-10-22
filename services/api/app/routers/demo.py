"""Simulador de sismos para demostraciones (D29). Solo Administrador y solo con
`DEMO_SIMULACION=true`: en una instalación normal la simulación responde 404."""

from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_role
from app.db.database import get_db
from app.db.models import User
from app.services import simulacion

router = APIRouter(dependencies=[Depends(require_role("admin"))])
_ADMIN = Depends(require_role("admin"))


class SimulacionIn(BaseModel):
    zona: Literal["mina_arequipa", "costa_lima", "mar_ica", "tacna", "cusco"]
    magnitud: float = Field(ge=2.5, le=8.5)
    cantidad: int = Field(default=1, ge=1, le=5, description="1 sismo o un sismo con réplicas")


@router.get("/status")
async def estado_demo() -> dict:
    return {
        "activo": simulacion.activo(),
        "zonas": [{"clave": k, "nombre": z["nombre"]} for k, z in simulacion.ZONAS.items()],
        "fuente": simulacion.NOMBRE_FUENTE,
    }


@router.post("/simulate")
async def simular_sismo(
    payload: SimulacionIn, request: Request, db: AsyncSession = Depends(get_db), actor: User = _ADMIN
) -> dict:
    return await simulacion.simular(
        db, actor, zona=payload.zona, magnitud=payload.magnitud, cantidad=payload.cantidad,
        correlation_id=getattr(request.state, "correlation_id", None),
    )
