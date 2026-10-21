"""Reglas de alertas y centro de alertas (PDF §6.8 y §6.9).

Reglas: se crean y editan inactivas; solo un Administrador las activa. Cualquiera
con el permiso `reglas` puede desactivarlas (detener avisos es siempre seguro).
La simulación retrospectiva dice cuántos avisos habría generado una regla en los
últimos N días antes de activarla (agregado empresarial #1 de CONTEXTO.md).

Centro: aprobar (entrega), cancelar con motivo, acuse y reintento de entregas.
"""

from __future__ import annotations

from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now
from app.db.models import Alert, AlertDelivery, AlertRule, AlertStatus, SeismicEvent, User
from app.schemas.alertas import ReglaIn
from app.services.alertas_motor import entregar, evento_alerta
from app.services.alertas_reglas import evaluar, marcadores, render
from app.services.audit import registrar_auditoria

#: Ejemplos que devuelve la simulación.
EJEMPLOS_SIMULACION = 20


def _a_columnas(payload: ReglaIn) -> dict:
    return {
        "name": payload.name,
        "description": payload.description,
        "condition_json": payload.condicion.model_dump(),
        "zone_spec": payload.zona.model_dump(),
        "severity": payload.severidad,
        "channels": list(payload.canales),
        "recipients": [str(d) for d in payload.destinatarios],
        "cooldown_seconds": payload.cooldown_minutos * 60,
        "requires_approval": payload.requiere_aprobacion,
        "max_event_age_hours": payload.antiguedad_max_horas,
        "title_template": payload.plantilla_titulo,
        "message_template": payload.plantilla_mensaje,
    }


# ── Reglas ──────────────────────────────────────────────────────────────────


async def obtener_regla(db: AsyncSession, regla_id: str) -> AlertRule:
    regla = await db.get(AlertRule, regla_id)
    if regla is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Regla no encontrada")
    return regla


async def listar_reglas(db: AsyncSession) -> list[AlertRule]:
    return list((await db.execute(select(AlertRule).order_by(AlertRule.created_at.desc()))).scalars())


async def crear_regla(db: AsyncSession, actor: User, payload: ReglaIn, *, correlation_id: str | None) -> AlertRule:
    regla = AlertRule(**_a_columnas(payload), enabled=False, created_by=actor.id)
    db.add(regla)
    await db.commit()
    await db.refresh(regla)
    registrar_auditoria(
        actor_id=actor.id, action="regla_creada", entity_type="alert_rule", entity_id=regla.id,
        after={"name": regla.name, "severity": regla.severity}, correlation_id=correlation_id,
    )
    return regla


async def editar_regla(
    db: AsyncSession, actor: User, regla_id: str, payload: ReglaIn, *, correlation_id: str | None
) -> AlertRule:
    regla = await obtener_regla(db, regla_id)
    if regla.enabled:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Desactive la regla antes de editarla; volverá a necesitar la activación de un Administrador.",
        )
    antes = {"condition_json": regla.condition_json, "zone_spec": regla.zone_spec, "channels": regla.channels}
    for campo, valor in _a_columnas(payload).items():
        setattr(regla, campo, valor)
    regla.approved_by = regla.approved_at = None
    await db.commit()
    await db.refresh(regla)
    registrar_auditoria(
        actor_id=actor.id, action="regla_editada", entity_type="alert_rule", entity_id=regla.id,
        before=antes, after={"condition_json": regla.condition_json, "zone_spec": regla.zone_spec, "channels": regla.channels},
        correlation_id=correlation_id,
    )
    return regla


async def cambiar_estado_regla(
    db: AsyncSession, actor: User, regla_id: str, activar: bool, *, correlation_id: str | None
) -> AlertRule:
    regla = await obtener_regla(db, regla_id)
    if regla.enabled == activar:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La regla ya está en ese estado.")
    regla.enabled = activar
    if activar:
        regla.approved_by, regla.approved_at = actor.id, clock_now()
    await db.commit()
    await db.refresh(regla)
    registrar_auditoria(
        actor_id=actor.id, action="regla_activada" if activar else "regla_desactivada", entity_type="alert_rule",
        entity_id=regla.id, before={"enabled": not activar}, after={"enabled": activar}, correlation_id=correlation_id,
    )
    return regla


async def simular(db: AsyncSession, payload: ReglaIn, dias: int) -> dict:
    """Cuántos avisos habría generado la regla en los últimos `dias` días (sin crear nada)."""
    cols = _a_columnas(payload)
    desde = clock_now() - timedelta(days=dias)
    eventos = list(
        (await db.execute(select(SeismicEvent).where(SeismicEvent.occurred_at >= desde).order_by(SeismicEvent.occurred_at))).scalars()
    )
    coincidencias, alertas, suprimidas, ultimo = 0, 0, 0, None
    ejemplos: list[dict] = []
    for evento in eventos:
        ev = evento_alerta(evento)
        coincide, distancia = evaluar(cols["condition_json"], cols["zone_spec"], ev)
        if not coincide:
            continue
        coincidencias += 1
        suprimida = ultimo is not None and ev.occurred_at - ultimo < timedelta(seconds=cols["cooldown_seconds"])
        if suprimida:
            suprimidas += 1
        else:
            alertas += 1
            ultimo = ev.occurred_at
        ejemplos.append(
            {
                "event_id": ev.id, "occurred_at": ev.occurred_at, "magnitude": ev.magnitude,
                "magnitude_type": ev.magnitude_type, "depth_km": ev.depth_km, "locality": ev.locality,
                "distance_km": distancia, "suprimida": suprimida,
                "titulo": render(cols["title_template"], marcadores(ev, distancia, cols["zone_spec"], cols["name"]))[:200],
            }
        )
    return {
        "dias": dias,
        "desde": desde,
        "eventos_evaluados": len(eventos),
        "coincidencias": coincidencias,
        "alertas": alertas,
        "suprimidas_por_cooldown": suprimidas,
        "ejemplos": list(reversed(ejemplos))[:EJEMPLOS_SIMULACION],
        "nota": "Simulación sobre sismos ya ocurridos: no crea avisos. Ya activa, la regla solo avisa de sismos más recientes que su antigüedad máxima.",
    }


# ── Centro de alertas ───────────────────────────────────────────────────────


async def obtener_alerta(db: AsyncSession, alerta_id: str) -> Alert:
    alerta = await db.get(Alert, alerta_id)
    if alerta is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alerta no encontrada")
    return alerta


async def listar_alertas(
    db: AsyncSession, *, estado: str | None, severidad: str | None, regla_id: str | None, page: int, page_size: int
) -> tuple[list[Alert], int]:
    filtros = []
    if estado:
        filtros.append(Alert.status == estado)
    if severidad:
        filtros.append(Alert.severity == severidad)
    if regla_id:
        filtros.append(Alert.rule_id == regla_id)
    total = await db.scalar(select(func.count()).select_from(Alert).where(*filtros)) or 0
    items = (
        await db.execute(
            select(Alert).where(*filtros).order_by(Alert.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    ).scalars().all()
    return list(items), total


async def entregas_de(db: AsyncSession, ids: list[str]) -> dict[str, list[AlertDelivery]]:
    resultado: dict[str, list[AlertDelivery]] = {i: [] for i in ids}
    if ids:
        for d in (await db.execute(select(AlertDelivery).where(AlertDelivery.alert_id.in_(ids)))).scalars():
            resultado[d.alert_id].append(d)
    return resultado


def _auditar(actor: User, alerta: Alert, accion: str, antes: str, correlation_id: str | None) -> None:
    registrar_auditoria(
        actor_id=actor.id, action=accion, entity_type="alert", entity_id=alerta.id,
        before={"status": antes}, after={"status": alerta.status}, correlation_id=correlation_id,
    )


async def aprobar(db: AsyncSession, actor: User, alerta_id: str, *, correlation_id: str | None) -> Alert:
    alerta = await obtener_alerta(db, alerta_id)
    if alerta.status != AlertStatus.PENDIENTE_APROBACION:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se aprueba un aviso pendiente de aprobación.")
    antes = alerta.status
    alerta.status, alerta.approved_by, alerta.approved_at = AlertStatus.APROBADA, actor.id, clock_now()
    await entregar(db, alerta, await obtener_regla(db, alerta.rule_id))
    await db.commit()
    await db.refresh(alerta)
    _auditar(actor, alerta, "alerta_aprobada", antes, correlation_id)
    return alerta


async def cancelar(db: AsyncSession, actor: User, alerta_id: str, motivo: str, *, correlation_id: str | None) -> Alert:
    alerta = await obtener_alerta(db, alerta_id)
    if alerta.status not in (AlertStatus.PENDIENTE_APROBACION, AlertStatus.APROBADA, AlertStatus.FALLIDA):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este aviso ya no se puede cancelar.")
    antes = alerta.status
    alerta.status, alerta.cancelled_by, alerta.cancelled_at, alerta.cancel_reason = (
        AlertStatus.CANCELADA, actor.id, clock_now(), motivo,
    )
    await db.commit()
    await db.refresh(alerta)
    _auditar(actor, alerta, "alerta_cancelada", antes, correlation_id)
    return alerta


async def acusar(db: AsyncSession, actor: User, alerta_id: str, *, correlation_id: str | None) -> Alert:
    alerta = await obtener_alerta(db, alerta_id)
    if alerta.status not in (AlertStatus.ENVIADA, AlertStatus.FALLIDA):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se da acuse de un aviso enviado.")
    if alerta.acknowledged_at is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este aviso ya tiene acuse de recibo.")
    alerta.acknowledged_by, alerta.acknowledged_at = actor.id, clock_now()
    await db.commit()
    await db.refresh(alerta)
    _auditar(actor, alerta, "alerta_acusada", alerta.status, correlation_id)
    return alerta


async def reintentar(db: AsyncSession, actor: User, alerta_id: str, *, correlation_id: str | None) -> Alert:
    alerta = await obtener_alerta(db, alerta_id)
    if alerta.status != AlertStatus.FALLIDA:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Solo se reintenta un aviso con entregas fallidas.")
    antes = alerta.status
    await entregar(db, alerta, await obtener_regla(db, alerta.rule_id))
    await db.commit()
    await db.refresh(alerta)
    _auditar(actor, alerta, "alerta_reintentada", antes, correlation_id)
    return alerta


__all__ = [
    "obtener_regla", "listar_reglas", "crear_regla", "editar_regla", "cambiar_estado_regla", "simular",
    "obtener_alerta", "listar_alertas", "entregas_de", "aprobar", "cancelar", "acusar", "reintentar",
]
