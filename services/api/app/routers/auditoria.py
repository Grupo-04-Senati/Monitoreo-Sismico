"""Endpoints del módulo "Auditoría" (6.13).

Consulta de la bitácora `audit_logs` (solo lectura; la tabla es de solo
inserción). Exige el permiso `auditoria` (Administrador y Auditor).

- `GET ""`: lista filtrada y paginada, con nombre y correo del usuario.
- `GET /facets`: acciones, entidades y usuarios presentes (para los filtros).
- `GET /export`: CSV de lo filtrado. La exportación **queda auditada**.
La retención se configura y aplica en el módulo Configuración (`/settings`).
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now
from app.core.permissions import require_permission
from app.db.database import get_db
from app.db.models import AuditLog, User
from app.schemas.auditoria import AuditFacetsOut, AuditLogListOut, AuditLogOut
from app.services import auditoria_consulta as consulta
from app.services.audit import registrar_auditoria

router = APIRouter(dependencies=[Depends(require_permission("auditoria"))])

_AUDITORIA = Depends(require_permission("auditoria"))


class _Filtros:
    """Filtros comunes de la lista y la exportación (query string)."""

    def __init__(
        self,
        actor_id: str | None = Query(default=None, max_length=36),
        action: str | None = Query(default=None, max_length=64),
        entity_type: str | None = Query(default=None, max_length=64),
        entity_id: str | None = Query(default=None, max_length=64),
        desde: datetime | None = Query(default=None, alias="from"),
        hasta: datetime | None = Query(default=None, alias="to"),
    ) -> None:
        self.valores = {
            "actor_id": actor_id, "action": action, "entity_type": entity_type,
            "entity_id": entity_id, "desde": desde, "hasta": hasta,
        }

    @property
    def condiciones(self) -> list:
        return consulta.filtros(**self.valores)

    @property
    def usados(self) -> dict:
        return {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in self.valores.items() if v}


@router.get("", response_model=AuditLogListOut)
async def list_audit_logs(
    f: _Filtros = Depends(),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> AuditLogListOut:
    total = await db.scalar(select(func.count()).select_from(AuditLog).where(*f.condiciones)) or 0
    filas = (
        await db.execute(
            select(AuditLog)
            .where(*f.condiciones)
            .order_by(AuditLog.occurred_at.desc(), AuditLog.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).scalars().all()
    mapa = await consulta.nombres(db, {x.actor_id for x in filas})
    items = []
    for x in filas:
        nombre, correo = mapa.get(x.actor_id or "", (None, None))
        items.append(AuditLogOut.model_validate(x).model_copy(update={"actor_name": nombre, "actor_email": correo}))
    return AuditLogListOut(items=items, total=total, page=page, page_size=page_size)


@router.get("/facets", response_model=AuditFacetsOut)
async def audit_facets(db: AsyncSession = Depends(get_db)) -> AuditFacetsOut:
    return AuditFacetsOut(**await consulta.valores_filtro(db))


@router.get("/export")
async def export_audit_logs(
    request: Request, f: _Filtros = Depends(), db: AsyncSession = Depends(get_db), actor: User = _AUDITORIA
) -> Response:
    contenido, filas = await consulta.csv_exportacion(db, f.condiciones)
    registrar_auditoria(
        actor_id=actor.id, action="auditoria_exportada", entity_type="audit_log", entity_id=None,
        after={"filas": filas, "filtros": f.usados, "tope": consulta.MAX_EXPORTACION},
        correlation_id=getattr(request.state, "correlation_id", None),
    )
    nombre = f"auditoria_{clock_now().strftime('%Y%m%d_%H%M')}.csv"
    return Response(
        content=contenido.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"', "X-Total-Filas": str(filas)},
    )
