"""Endpoints del módulo "Centro de alertas" (6.9).

Avisos operativos **internos** (nunca alertas oficiales). Permiso `alertas`
(Administrador y Operador de alertas): consultar, aprobar (entrega), cancelar con
motivo, dar acuse y reintentar entregas fallidas. Todo queda en la auditoría.
"""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import require_permission
from app.db.database import get_db
from app.db.models import Alert, AlertDelivery, AlertRule, SeismicEvent, User
from app.schemas.alertas import AlertaListOut, AlertaOut, CancelarIn, EntregaOut, EventoResumenOut
from app.services import alertas as servicio

router = APIRouter(dependencies=[Depends(require_permission("alertas"))])

_ALERTAS = Depends(require_permission("alertas"))


def _correlacion(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


async def _salidas(db: AsyncSession, alertas: list[Alert]) -> list[AlertaOut]:
    ids = [a.id for a in alertas]
    entregas = await servicio.entregas_de(db, ids)
    reglas = {
        r.id: r.name
        for r in (await db.execute(select(AlertRule).where(AlertRule.id.in_({a.rule_id for a in alertas})))).scalars()
    } if alertas else {}
    eventos = {
        e.id: e
        for e in (await db.execute(select(SeismicEvent).where(SeismicEvent.id.in_({a.event_id for a in alertas})))).scalars()
    } if alertas else {}
    salidas = []
    for a in alertas:
        datos = {c.name: getattr(a, c.name) for c in Alert.__table__.columns}
        e = eventos.get(a.event_id)
        salidas.append(
            AlertaOut(
                **datos,
                rule_name=reglas.get(a.rule_id),
                evento=EventoResumenOut(
                    id=e.id, occurred_at=e.occurred_at, magnitude=e.magnitude, magnitude_type=e.magnitude_type,
                    depth_km=e.depth_km, locality=e.locality, latitude=e.latitude, longitude=e.longitude,
                ) if e else None,
                entregas=[EntregaOut.model_validate(d) for d in entregas.get(a.id, [])],
            )
        )
    return salidas


@router.get("", response_model=AlertaListOut)
async def list_alerts(
    estado: Literal["pendiente_aprobacion", "aprobada", "enviada", "fallida", "cancelada", "suprimida"] | None = Query(default=None),
    severidad: Literal["informativa", "importante", "critica"] | None = Query(default=None),
    regla: str | None = Query(default=None, max_length=36),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> AlertaListOut:
    items, total = await servicio.listar_alertas(
        db, estado=estado, severidad=severidad, regla_id=regla, page=page, page_size=page_size
    )
    return AlertaListOut(items=await _salidas(db, items), total=total, page=page, page_size=page_size)


@router.get("/{alert_id}", response_model=AlertaOut)
async def get_alert(alert_id: str, db: AsyncSession = Depends(get_db)) -> AlertaOut:
    return (await _salidas(db, [await servicio.obtener_alerta(db, alert_id)]))[0]


@router.post("/{alert_id}/approve", response_model=AlertaOut)
async def approve_alert(alert_id: str, request: Request, db: AsyncSession = Depends(get_db), actor: User = _ALERTAS) -> AlertaOut:
    alerta = await servicio.aprobar(db, actor, alert_id, correlation_id=_correlacion(request))
    return (await _salidas(db, [alerta]))[0]


@router.post("/{alert_id}/cancel", response_model=AlertaOut)
async def cancel_alert(
    alert_id: str, payload: CancelarIn, request: Request, db: AsyncSession = Depends(get_db), actor: User = _ALERTAS
) -> AlertaOut:
    alerta = await servicio.cancelar(db, actor, alert_id, payload.motivo, correlation_id=_correlacion(request))
    return (await _salidas(db, [alerta]))[0]


@router.post("/{alert_id}/acknowledge", response_model=AlertaOut)
async def acknowledge_alert(alert_id: str, request: Request, db: AsyncSession = Depends(get_db), actor: User = _ALERTAS) -> AlertaOut:
    alerta = await servicio.acusar(db, actor, alert_id, correlation_id=_correlacion(request))
    return (await _salidas(db, [alerta]))[0]


@router.post("/{alert_id}/retry", response_model=AlertaOut)
async def retry_alert(alert_id: str, request: Request, db: AsyncSession = Depends(get_db), actor: User = _ALERTAS) -> AlertaOut:
    alerta = await servicio.reintentar(db, actor, alert_id, correlation_id=_correlacion(request))
    return (await _salidas(db, [alerta]))[0]
