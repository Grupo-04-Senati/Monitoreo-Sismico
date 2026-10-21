"""Endpoints del módulo "Reglas de alertas" (6.8).

- Consultar, crear, editar, simular y desactivar: permiso `reglas` (Administrador y
  Operador de alertas). Una regla se crea y edita inactiva.
- Activar: solo Administrador (aprobador de la regla).
Todo cambio queda en la auditoría.
"""

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission, require_role
from app.db.database import get_db
from app.db.models import User
from app.schemas.alertas import ReglaIn, ReglaListOut, ReglaOut, SimulacionIn, SimulacionOut
from app.services import alertas as servicio

router = APIRouter(dependencies=[Depends(require_permission("reglas"))])

_REGLAS = Depends(require_permission("reglas"))
_ADMIN = Depends(require_role("admin"))


def _correlacion(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@router.get("", response_model=ReglaListOut)
async def list_alert_rules(db: AsyncSession = Depends(get_db)) -> ReglaListOut:
    reglas = await servicio.listar_reglas(db)
    return ReglaListOut(items=[ReglaOut.model_validate(r) for r in reglas], total=len(reglas))


@router.post("", response_model=ReglaOut, status_code=status.HTTP_201_CREATED)
async def create_alert_rule(
    payload: ReglaIn, request: Request, db: AsyncSession = Depends(get_db), actor: User = _REGLAS
) -> ReglaOut:
    return ReglaOut.model_validate(await servicio.crear_regla(db, actor, payload, correlation_id=_correlacion(request)))


@router.post("/simulate", response_model=SimulacionOut)
async def simulate_alert_rule(payload: SimulacionIn, db: AsyncSession = Depends(get_db)) -> SimulacionOut:
    """Simulación retrospectiva de una regla (guardada o no): no crea avisos."""
    return SimulacionOut(**await servicio.simular(db, payload.regla, payload.dias))


@router.get("/{rule_id}", response_model=ReglaOut)
async def get_alert_rule(rule_id: str, db: AsyncSession = Depends(get_db)) -> ReglaOut:
    return ReglaOut.model_validate(await servicio.obtener_regla(db, rule_id))


@router.put("/{rule_id}", response_model=ReglaOut)
async def update_alert_rule(
    rule_id: str, payload: ReglaIn, request: Request, db: AsyncSession = Depends(get_db), actor: User = _REGLAS
) -> ReglaOut:
    regla = await servicio.editar_regla(db, actor, rule_id, payload, correlation_id=_correlacion(request))
    return ReglaOut.model_validate(regla)


@router.post("/{rule_id}/activate", response_model=ReglaOut)
async def activate_alert_rule(
    rule_id: str, request: Request, db: AsyncSession = Depends(get_db), actor: User = _ADMIN
) -> ReglaOut:
    regla = await servicio.cambiar_estado_regla(db, actor, rule_id, True, correlation_id=_correlacion(request))
    return ReglaOut.model_validate(regla)


@router.post("/{rule_id}/deactivate", response_model=ReglaOut)
async def deactivate_alert_rule(
    rule_id: str, request: Request, db: AsyncSession = Depends(get_db), actor: User = _REGLAS
) -> ReglaOut:
    regla = await servicio.cambiar_estado_regla(db, actor, rule_id, False, correlation_id=_correlacion(request))
    return ReglaOut.model_validate(regla)
