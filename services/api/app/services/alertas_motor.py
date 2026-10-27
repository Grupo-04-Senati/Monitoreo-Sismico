"""Motor de avisos: evalúa eventos nuevos contra las reglas activas y entrega.

- Tras cada sincronización se evalúan los eventos **insertados en esa ejecución**
  que además sean recientes (`max_event_age_hours`): una carga histórica no avisa.
- Un aviso por evento y regla: la restricción única de la base deduplica aunque
  el motor corra dos veces.
- Cooldown: si la regla ya avisó de un evento ocurrido hace menos de su cooldown,
  el nuevo aviso se registra como "suprimido" (queda la traza, no se entrega).
- Con aprobación humana el aviso queda "pendiente_aprobacion"; sin ella se entrega.
- Canal SMS (D31): un SMS por usuario activo de los roles de la regla con celular
  verificado y consentimiento vigente; sin Twilio configurado la entrega es "simulada".
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now
from app.db.models import Alert, AlertDelivery, AlertRule, AlertStatus, Role, SeismicEvent, User, UserStatus
from app.services.alertas_reglas import EventoAlerta, es_reciente, evaluar, marcadores, render
from app.services.audit import registrar_auditoria
from app.services.notifications import email as canal_email
from app.services.notifications import sms as canal_sms

logger = logging.getLogger("sismo.alertas")

#: Estados que cuentan para el cooldown (un aviso cancelado o suprimido no).
_AVISOS_VIGENTES = (AlertStatus.PENDIENTE_APROBACION, AlertStatus.APROBADA, AlertStatus.ENVIADA, AlertStatus.FALLIDA)


def evento_alerta(e: SeismicEvent) -> EventoAlerta:
    return EventoAlerta(
        id=e.id,
        occurred_at=e.occurred_at,
        latitude=e.latitude,
        longitude=e.longitude,
        depth_km=e.depth_km,
        magnitude=e.magnitude,
        magnitude_type=e.magnitude_type,
        review_status=e.review_status,
        locality=e.locality,
        source_url=e.source_url,
    )


async def _ultimo_evento_avisado(db: AsyncSession, regla_id: str) -> datetime | None:
    return await db.scalar(
        select(func.max(SeismicEvent.occurred_at))
        .join(Alert, Alert.event_id == SeismicEvent.id)
        .where(Alert.rule_id == regla_id, Alert.status.in_(_AVISOS_VIGENTES))
    )


async def destinatarios_sms(db: AsyncSession, roles: list[str]) -> list[User]:
    """Usuarios activos de esos roles con celular verificado y consentimiento vigente."""
    if not roles:
        return []
    consulta = select(User).where(
        User.status == UserStatus.ACTIVE,
        User.phone_e164.is_not(None),
        User.phone_verified_at.is_not(None),
        User.sms_consent_at.is_not(None),
        User.roles.any(Role.name.in_(roles)),
    )
    return list((await db.execute(consulta)).scalars())


async def texto_sms(db: AsyncSession, alerta: Alert) -> str:
    """Texto corto (un SMS): qué, dónde, cuándo y que no es una alerta oficial."""
    evento = await db.get(SeismicEvent, alerta.event_id)
    cuando = ""
    if evento is not None:
        cuando = evento.occurred_at.astimezone(timezone(timedelta(hours=-5))).strftime(" %d/%m %H:%M")
    distancia = f", a {alerta.distance_km:.0f} km" if alerta.distance_km is not None else ""
    return f"[Sismora] Aviso interno: {alerta.title}{distancia},{cuando} (UTC-5). No es alerta oficial: IGP/INDECI."[:320]


async def entregar(db: AsyncSession, alerta: Alert, regla: AlertRule) -> None:
    """Crea o reintenta las entregas pendientes del aviso y fija su estado final."""
    destinos: list[tuple[str, str]] = []
    if "app" in regla.channels:
        destinos.append(("app", "bandeja"))
    if "email" in regla.channels:
        destinos += [("email", d) for d in regla.recipients]
    telefonos: dict[str, str] = {}
    if "sms" in regla.channels:
        for u in await destinatarios_sms(db, list(regla.sms_roles or [])):
            destinos.append(("sms", f"usuario:{u.id}"))
            telefonos[f"usuario:{u.id}"] = u.phone_e164 or ""
    cuerpo_sms = await texto_sms(db, alerta) if telefonos else ""

    existentes = {
        (d.channel, d.destination): d
        for d in (await db.execute(select(AlertDelivery).where(AlertDelivery.alert_id == alerta.id))).scalars()
    }
    ahora = clock_now()
    for canal, destino in destinos:
        entrega = existentes.get((canal, destino))
        if entrega is not None and entrega.status != "fallida":
            continue  # idempotente: lo entregado o simulado no se repite
        if entrega is None:
            entrega = AlertDelivery(alert_id=alerta.id, channel=canal, destination=destino, status="fallida", attempts=0)
            db.add(entrega)
        entrega.attempts += 1
        entrega.last_attempt_at = ahora
        if canal == "app":
            entrega.status, entrega.delivered_at, entrega.error = "entregada", ahora, None
            continue
        if canal == "sms":
            try:
                await asyncio.to_thread(canal_sms.enviar, telefonos[destino], cuerpo_sms)
                entrega.status, entrega.delivered_at, entrega.error = "entregada", ahora, None
            except canal_sms.SmsDesactivado as exc:
                entrega.status, entrega.error = "simulada", str(exc)[:300]
            except canal_sms.SmsFallido as exc:
                entrega.status, entrega.error = "fallida", str(exc)[:300]
            except Exception as exc:  # noqa: BLE001 - se registra y se puede reintentar
                entrega.status, entrega.error = "fallida", f"{type(exc).__name__}"[:300]
            continue
        try:
            await asyncio.to_thread(canal_email.enviar, destino, alerta.title, alerta.message)
            entrega.status, entrega.delivered_at, entrega.error = "entregada", ahora, None
        except canal_email.CorreoDesactivado as exc:
            entrega.status, entrega.error = "simulada", str(exc)[:300]
        except Exception as exc:  # noqa: BLE001 - se registra y se puede reintentar
            entrega.status, entrega.error = "fallida", f"{type(exc).__name__}"[:300]
    await db.flush()
    estados = [
        d.status for d in (await db.execute(select(AlertDelivery).where(AlertDelivery.alert_id == alerta.id))).scalars()
    ]
    alerta.status = AlertStatus.FALLIDA if "fallida" in estados else AlertStatus.ENVIADA


async def evaluar_eventos(db: AsyncSession, eventos: list[SeismicEvent], *, ahora: datetime | None = None) -> int:
    """Crea los avisos que correspondan; devuelve cuántos se crearon (incluidos los suprimidos)."""
    ahora = ahora or clock_now()
    reglas = list((await db.execute(select(AlertRule).where(AlertRule.enabled.is_(True)))).scalars())
    if not reglas or not eventos:
        return 0
    creados = 0
    for regla in reglas:
        ultimo = await _ultimo_evento_avisado(db, regla.id)
        for evento in sorted(eventos, key=lambda e: e.occurred_at):
            ev = evento_alerta(evento)
            coincide, distancia = evaluar(regla.condition_json, regla.zone_spec, ev)
            if not coincide or not es_reciente(ev, ahora, regla.max_event_age_hours):
                continue
            suprimida = ultimo is not None and ev.occurred_at - ultimo < timedelta(seconds=regla.cooldown_seconds)
            estado = (
                AlertStatus.SUPRIMIDA
                if suprimida
                else AlertStatus.PENDIENTE_APROBACION if regla.requires_approval else AlertStatus.APROBADA
            )
            valores = marcadores(ev, distancia, regla.zone_spec, regla.name)
            fila = await db.execute(
                pg_insert(Alert)
                .values(
                    id=str(uuid.uuid4()),
                    rule_id=regla.id,
                    event_id=ev.id,
                    severity=regla.severity,
                    title=render(regla.title_template, valores)[:200],
                    message=render(regla.message_template, valores)[:1200],
                    source_url=ev.source_url,
                    distance_km=distancia,
                    status=estado,
                )
                .on_conflict_do_nothing(constraint="uq_alerts_event_rule")
                .returning(Alert.id)
            )
            alerta_id = fila.scalar_one_or_none()
            if alerta_id is None:
                continue  # ya existía un aviso para este evento y regla
            creados += 1
            if not suprimida:
                ultimo = ev.occurred_at
            alerta = await db.get(Alert, alerta_id)
            if estado == AlertStatus.APROBADA:
                await entregar(db, alerta, regla)
            registrar_auditoria(
                actor_id=None,
                action="alerta_generada",
                entity_type="alert",
                entity_id=alerta_id,
                after={"rule_id": regla.id, "event_id": ev.id, "status": alerta.status},
            )
    await db.commit()
    return creados


async def evaluar_insertados_desde(db: AsyncSession, desde: datetime) -> int:
    """Evalúa los eventos insertados **o corregidos** desde `desde` (última sincronización).

    Un sismo corregido (p. ej. de M4.9 a M5.1) puede cumplir ahora una regla: se evalúa
    de nuevo; la restricción única evento-regla impide avisar dos veces (D27).
    """
    eventos = list(
        (
            await db.execute(
                select(SeismicEvent).where(or_(SeismicEvent.created_at >= desde, SeismicEvent.revised_at >= desde))
            )
        ).scalars()
    )
    return await evaluar_eventos(db, eventos)


__all__ = ["evaluar_eventos", "evaluar_insertados_desde", "entregar", "evento_alerta"]
