"""Parámetros del sistema, retención de la auditoría y entorno (PDF §6.13 y §12).

Solo son editables los parámetros del catálogo `PARAMETROS`, y cada uno lo usa
de verdad algún módulo (no hay perillas decorativas). Cada cambio queda en la
auditoría con antes/después (control de cambios). Lo que vive en `.env`
(secretos, CORS, cookies, SMTP) se muestra en solo lectura y sin secretos.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now
from app.core.config import settings
from app.db.models import AuditLog, SystemSetting, User
from app.services import login_throttle
from app.services.audit import registrar_auditoria
from app.services.auditoria_consulta import nombres
from app.services.notifications import email as canal_email

#: Piso de retención que impone también el trigger de `audit_logs` (migración 0017).
RETENCION_MINIMA_DIAS = 365


@dataclass(frozen=True)
class Parametro:
    clave: str
    etiqueta: str
    descripcion: str
    grupo: str
    unidad: str
    minimo: int
    maximo: int
    defecto: int
    #: Dónde y cuándo se aplica, para que nadie espere un efecto que no tiene.
    efecto: str


PARAMETROS: dict[str, Parametro] = {
    p.clave: p
    for p in (
        Parametro(
            clave="reportes_ttl_horas",
            etiqueta="Vigencia de los reportes descargables",
            descripcion="Horas que un reporte generado se puede descargar antes de expirar.",
            grupo="Reportes",
            unidad="h",
            minimo=1,
            maximo=168,
            defecto=24,
            efecto="Se aplica a los reportes que se generen desde el cambio.",
        ),
        Parametro(
            clave="estimaciones_horas_datos_recientes",
            etiqueta="Umbral de datos desactualizados",
            descripcion="Si la última sincronización correcta es más antigua, cada estimación nueva lo advierte.",
            grupo="Estimaciones",
            unidad="h",
            minimo=6,
            maximo=720,
            defecto=48,
            efecto="Se aplica a las estimaciones que se generen desde el cambio.",
        ),
        Parametro(
            clave="auditoria_retencion_dias",
            etiqueta="Retención de la auditoría",
            descripcion="Antigüedad a partir de la cual un Administrador puede purgar registros de auditoría.",
            grupo="Auditoría",
            unidad="días",
            minimo=RETENCION_MINIMA_DIAS,
            maximo=3650,
            defecto=730,
            efecto="Solo al ejecutar una purga (manual y auditada). Nunca menos de 365 días.",
        ),
    )
}


def _parametro(clave: str) -> Parametro:
    p = PARAMETROS.get(clave)
    if p is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parámetro desconocido")
    return p


async def valor(db: AsyncSession, clave: str) -> int:
    """Valor vigente de un parámetro (el guardado o su valor por defecto)."""
    p = _parametro(clave)
    guardado = await db.get(SystemSetting, clave)
    if guardado is None:
        return p.defecto
    v = guardado.value.get("valor") if isinstance(guardado.value, dict) else None
    return v if isinstance(v, int) and p.minimo <= v <= p.maximo else p.defecto


async def listar(db: AsyncSession) -> list[dict[str, Any]]:
    guardados = {s.key: s for s in (await db.execute(select(SystemSetting))).scalars()}
    mapa = await nombres(db, {s.updated_by for s in guardados.values()})
    salida = []
    for p in PARAMETROS.values():
        s = guardados.get(p.clave)
        salida.append(
            {
                **asdict(p),
                "valor": await valor(db, p.clave),
                "personalizado": s is not None,
                "actualizado_en": s.updated_at if s else None,
                "actualizado_por": mapa.get(s.updated_by or "", (None,))[0] if s else None,
            }
        )
    return salida


async def cambiar(db: AsyncSession, actor: User, clave: str, nuevo: int, *, correlation_id: str | None) -> dict[str, Any]:
    p = _parametro(clave)
    if not p.minimo <= nuevo <= p.maximo:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{p.etiqueta}: el valor debe estar entre {p.minimo} y {p.maximo} {p.unidad}.",
        )
    anterior = await valor(db, clave)
    if anterior == nuevo:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El parámetro ya tiene ese valor.")
    fila = await db.get(SystemSetting, clave)
    if fila is None:
        db.add(SystemSetting(key=clave, value={"valor": nuevo}, updated_by=actor.id))
    else:
        fila.value, fila.updated_by = {"valor": nuevo}, actor.id
    await db.commit()
    registrar_auditoria(
        actor_id=actor.id, action="parametro_cambiado", entity_type="system_setting", entity_id=clave,
        before={"valor": anterior}, after={"valor": nuevo}, correlation_id=correlation_id,
    )
    return next(x for x in await listar(db) if x["clave"] == clave)


async def historial(db: AsyncSession, limite: int = 50) -> list[dict[str, Any]]:
    """Control de cambios: cambios de parámetros y purgas de la auditoría."""
    filas = (
        await db.execute(
            select(AuditLog)
            .where(AuditLog.action.in_(("parametro_cambiado", "auditoria_purgada")))
            .order_by(AuditLog.occurred_at.desc(), AuditLog.id)
            .limit(limite)
        )
    ).scalars().all()
    mapa = await nombres(db, {f.actor_id for f in filas})
    return [
        {
            "id": f.id,
            "accion": f.action,
            "clave": f.entity_id,
            "etiqueta": PARAMETROS[f.entity_id].etiqueta if f.entity_id in PARAMETROS else None,
            "antes": f.before_json,
            "despues": f.after_json,
            "fecha": f.occurred_at,
            "actor": mapa.get(f.actor_id or "", (None,))[0],
        }
        for f in filas
    ]


# ── Retención de la auditoría ───────────────────────────────────────────────


async def estado_retencion(db: AsyncSession) -> dict[str, Any]:
    dias = await valor(db, "auditoria_retencion_dias")
    corte = clock_now() - timedelta(days=dias)
    total = await db.scalar(select(func.count()).select_from(AuditLog)) or 0
    a_purgar = await db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.occurred_at < corte)) or 0
    return {
        "retencion_dias": dias,
        "minimo_dias": RETENCION_MINIMA_DIAS,
        "corte": corte,
        "total": total,
        "a_purgar": a_purgar,
        "mas_antiguo": await db.scalar(select(func.min(AuditLog.occurred_at))),
    }


async def purgar(db: AsyncSession, actor: User, *, correlation_id: str | None) -> dict[str, Any]:
    """Borra los registros más antiguos que la retención. La base exige además el piso de 365 días."""
    estado = await estado_retencion(db)
    if estado["a_purgar"] == 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No hay registros más antiguos que la retención.")
    try:
        await db.execute(text("SET LOCAL sismo.purga_auditoria = 'on'"))
        resultado = await db.execute(delete(AuditLog).where(AuditLog.occurred_at < estado["corte"]))
        await db.commit()
    except DBAPIError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La base rechazó la purga (protege los registros de menos de 365 días).",
        ) from exc
    borrados = resultado.rowcount or 0
    registrar_auditoria(
        actor_id=actor.id, action="auditoria_purgada", entity_type="audit_log", entity_id=None,
        before={"total": estado["total"]},
        after={"borrados": borrados, "corte": estado["corte"].isoformat(), "retencion_dias": estado["retencion_dias"]},
        correlation_id=correlation_id,
    )
    return {**(await estado_retencion(db)), "borrados": borrados}


# ── Entorno (solo lectura, sin secretos) ────────────────────────────────────


def entorno() -> dict[str, Any]:
    produccion = settings.ENV == "production"
    advertencias = []
    if settings.API_SECRET_KEY == "dev-secret-change-me":
        advertencias.append("La clave de firma de sesiones es la de desarrollo: cámbiela en .env (API_SECRET_KEY).")
    if produccion and not settings.COOKIE_SECURE:
        advertencias.append("En producción las cookies deben ser seguras (COOKIE_SECURE=true, con HTTPS).")
    if produccion and settings.API_DEBUG:
        advertencias.append("API_DEBUG está activo en producción.")
    if settings.ALERT_EMAIL_ENABLED and not canal_email.configurado():
        advertencias.append("El correo de avisos está activado pero faltan SMTP_HOST o SMTP_FROM: las entregas fallarán.")
    return {
        "entorno": settings.ENV,
        "fuente_activa": settings.INGESTION_SOURCE_KEY,
        "origenes_cors": settings.CORS_ORIGINS,
        "cookies_seguras": settings.COOKIE_SECURE,
        "sesion_minutos": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        "correo": {
            "activado": settings.ALERT_EMAIL_ENABLED,
            "configurado": canal_email.configurado(),
            "servidor": settings.SMTP_HOST or None,
            "remitente": settings.SMTP_FROM or None,
        },
        "acceso": {
            "intentos_antes_de_bloqueo": login_throttle.MAX_INTENTOS,
            "bloqueo_minutos": login_throttle.BLOQUEO_SEG // 60,
            "intentos_por_ip_por_minuto": login_throttle.MAX_INTENTOS_IP,
        },
        "advertencias": advertencias,
    }


__all__ = [
    "PARAMETROS", "RETENCION_MINIMA_DIAS", "valor", "listar", "cambiar", "historial",
    "estado_retencion", "purgar", "entorno",
]
