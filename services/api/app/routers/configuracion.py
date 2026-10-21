"""Endpoints del módulo "Configuración" (PDF §6.13). Solo Administrador (permiso
`configuracion`): parámetros del sistema, control de cambios, retención de la
auditoría y entorno en solo lectura. Todo cambio queda en la auditoría.
"""

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.db.database import get_db
from app.db.models import User
from app.schemas.configuracion import CambioIn, CambioOut, ConfiguracionOut, ParametroOut, RetencionOut
from app.services import configuracion as servicio

router = APIRouter(dependencies=[Depends(require_permission("configuracion"))])

_CONFIG = Depends(require_permission("configuracion"))


def _correlacion(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


@router.get("", response_model=ConfiguracionOut)
async def get_settings(db: AsyncSession = Depends(get_db)) -> ConfiguracionOut:
    return ConfiguracionOut(parametros=await servicio.listar(db), entorno=await servicio.entorno(db))


@router.get("/history", response_model=list[CambioOut])
async def settings_history(limite: int = Query(default=50, ge=1, le=200), db: AsyncSession = Depends(get_db)) -> list[CambioOut]:
    return [CambioOut(**c) for c in await servicio.historial(db, limite)]


@router.get("/audit-retention", response_model=RetencionOut)
async def audit_retention(db: AsyncSession = Depends(get_db)) -> RetencionOut:
    return RetencionOut(**await servicio.estado_retencion(db))


@router.post("/audit-retention/purge", response_model=RetencionOut)
async def purge_audit(request: Request, db: AsyncSession = Depends(get_db), actor: User = _CONFIG) -> RetencionOut:
    return RetencionOut(**await servicio.purgar(db, actor, correlation_id=_correlacion(request)))


@router.put("/{clave}", response_model=ParametroOut)
async def update_setting(
    clave: str, payload: CambioIn, request: Request, db: AsyncSession = Depends(get_db), actor: User = _CONFIG
) -> ParametroOut:
    return ParametroOut(**await servicio.cambiar(db, actor, clave, payload.valor, correlation_id=_correlacion(request)))
