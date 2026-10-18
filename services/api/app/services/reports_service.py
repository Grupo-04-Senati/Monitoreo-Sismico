"""Servicio del módulo "Reportes" (6.11).

Orquesta el ciclo de vida de un trabajo de informe: creación (con validación de
tipo, formato y permisos), generación en segundo plano, expiración del enlace y
descarga **autorizada** (solicitante o Administrador). Cada generación y cada
descarga quedan registradas en Auditoría.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now
from app.core.permissions import permissions_for
from app.db.database import AsyncSessionLocal
from app.db.models import DataSource, ReportJob, ReportStatus, User
from app.schemas.reportes import (
    ReportCreateIn,
    ReportListOut,
    ReportOut,
    ReportResumenOut,
    ReportTipoEstadoOut,
    ReportTypeOut,
)
from app.services.audit import registrar_auditoria
from app.services.reports import obtener_proveedor
from app.services.reports.base import ReportParams
from app.services.reports.generator import escribir_archivo

ETIQUETAS_TIPO: dict[str, str] = {
    "eventos": "Eventos sísmicos",
    "calidad_datos": "Calidad de datos",
    "fuentes_ingesta": "Fuentes e ingesta",
    "modelos": "Modelos ML",
    "alertas": "Alertas",
}

ETIQUETAS_ESTADO: dict[str, str] = {
    ReportStatus.PENDIENTE: "Pendiente",
    ReportStatus.EN_PROCESO: "En proceso",
    ReportStatus.LISTO: "Listo",
    ReportStatus.FALLIDO: "Fallido",
    ReportStatus.EXPIRADO: "Expirado",
}

#: Horas que vive un enlace antes de expirar.
TTL_HORAS = 24
#: Un enlace se resalta como "por expirar" cuando le quedan menos de estas horas.
UMBRAL_POR_EXPIRAR_HORAS = 6

_PERIODOS_DIAS: dict[str, int] = {"24h": 1, "7d": 7, "30d": 30, "90d": 90}

FORMATOS_VALIDOS: tuple[str, ...] = ("csv", "xlsx", "pdf")


def _ahora() -> datetime:
    return clock_now()


def _aware(valor: datetime) -> datetime:
    return valor if valor.tzinfo else valor.replace(tzinfo=timezone.utc)


def _permisos(actor: User) -> set[str]:
    otorgados: set[str] = set()
    for rol in actor.role_names:
        otorgados |= permissions_for(rol)
    return otorgados


def _es_admin(actor: User) -> bool:
    return "admin" in actor.role_names


def listar_tipos(actor: User) -> list[ReportTypeOut]:
    """Tipos de informe con su disponibilidad y formatos permitidos."""
    permisos = _permisos(actor)
    formatos = [f for f in FORMATOS_VALIDOS if f != "pdf" or "reportes_pdf" in permisos]
    items: list[ReportTypeOut] = []
    for proveedor in (obtener_proveedor(t) for t in ETIQUETAS_TIPO):
        assert proveedor is not None
        items.append(
            ReportTypeOut(
                tipo=proveedor.tipo,
                etiqueta=proveedor.etiqueta,
                disponible=proveedor.disponible,
                formatos=list(formatos),
            )
        )
    return items


def _rango(payload: ReportCreateIn, corte: datetime) -> tuple[str, date | None, date | None]:
    hoy = corte.date()
    if payload.periodo in _PERIODOS_DIAS:
        dias = _PERIODOS_DIAS[payload.periodo]
        return payload.periodo, hoy - timedelta(days=dias), hoy
    if payload.periodo == "personalizado" and payload.desde and payload.hasta:
        return "personalizado", date.fromisoformat(payload.desde), date.fromisoformat(payload.hasta)
    return "historico", None, hoy


async def crear_reporte(
    db: AsyncSession,
    actor: User,
    payload: ReportCreateIn,
    correlation_id: str | None = None,
) -> ReportJob:
    proveedor = obtener_proveedor(payload.tipo)
    if proveedor is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tipo de informe no válido.",
        )
    if not proveedor.disponible:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este tipo de informe estará disponible próximamente.",
        )
    formato = (payload.formato or "").lower()
    if formato not in proveedor.formatos:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Formato no soportado para {proveedor.etiqueta}.",
        )
    if formato == "pdf" and "reportes_pdf" not in _permisos(actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para exportar en PDF.",
        )

    corte = _ahora()
    periodo, desde, hasta = _rango(payload, corte)

    #: Fuente real del catálogo (nunca un nombre fijo); "—" si aún no hay ninguna.
    fuente_nombre = (
        await db.execute(select(DataSource.name).order_by(DataSource.created_at).limit(1))
    ).scalar_one_or_none() or "—"

    job = ReportJob(
        tipo=proveedor.tipo,
        formato=formato,
        name=f"{proveedor.etiqueta} · {corte.date().isoformat()} ({formato.upper()})",
        requested_by=actor.id,
        source=fuente_nombre,
        status=ReportStatus.PENDIENTE,
        corte=corte,
        params={
            "tipo": proveedor.tipo,
            "formato": formato,
            "periodo": periodo,
            "desde": desde.isoformat() if desde else None,
            "hasta": hasta.isoformat() if hasta else None,
            "zona": payload.zona,
            "filtros": payload.filtros,
            "solicitante": actor.full_name,
        },
    )
    job.params["corte"] = corte.isoformat()

    db.add(job)
    await db.commit()
    await db.refresh(job)

    registrar_auditoria(
        actor_id=actor.id,
        action="reporte_solicitado",
        entity_type="report_job",
        entity_id=job.id,
        after={"tipo": job.tipo, "formato": job.formato, "corte": job.corte.isoformat()},
        correlation_id=correlation_id,
    )
    return job


def _params_desde_job(job: ReportJob) -> ReportParams:
    datos = job.params or {}
    return ReportParams(
        tipo=job.tipo,
        formato=job.formato,
        corte=_aware(job.corte).date(),
        periodo=datos.get("periodo"),
        desde=date.fromisoformat(datos["desde"]) if datos.get("desde") else None,
        hasta=date.fromisoformat(datos["hasta"]) if datos.get("hasta") else None,
        zona=datos.get("zona"),
        filtros=datos.get("filtros") or {},
        solicitante=datos.get("solicitante") or "",
    )


async def generar_reporte(db: AsyncSession, job: ReportJob) -> ReportJob:
    """Genera el archivo del informe (idempotente en su estado final)."""
    proveedor = obtener_proveedor(job.tipo)
    if proveedor is None or not proveedor.disponible:
        job.status = ReportStatus.FALLIDO
        job.error = "Proveedor de informe no disponible."
        job.finished_at = _ahora()
        await db.commit()
        return job

    job.status = ReportStatus.EN_PROCESO
    job.started_at = _ahora()
    await db.commit()

    try:
        data = await proveedor.generar(db, _params_desde_job(job))
        ruta, tamano = escribir_archivo(data, job.formato, nombre_base=job.name)
        job.file_path = str(ruta)
        job.file_size = tamano
        job.row_count = len(data.filas)
        job.status = ReportStatus.LISTO
        job.finished_at = _ahora()
        job.expires_at = _ahora() + timedelta(hours=TTL_HORAS)
        job.error = None
        await db.commit()
        registrar_auditoria(
            actor_id=job.requested_by,
            action="reporte_generado",
            entity_type="report_job",
            entity_id=job.id,
            after={"filas": job.row_count, "formato": job.formato, "expira_en_horas": TTL_HORAS},
        )
    except Exception as exc:  # noqa: BLE001 - se refleja en el trabajo
        job.status = ReportStatus.FALLIDO
        job.error = str(exc)[:500]
        job.finished_at = _ahora()
        await db.commit()
        registrar_auditoria(
            actor_id=job.requested_by,
            action="reporte_fallido",
            entity_type="report_job",
            entity_id=job.id,
            after={"error": job.error},
        )
    return job


async def generar_en_background(report_id: str) -> None:
    """Tarea de fondo: abre su propia sesión y genera el informe."""
    async with AsyncSessionLocal() as db:
        job = await db.get(ReportJob, report_id)
        if job is None:
            return
        await generar_reporte(db, job)


async def marcar_expirados(db: AsyncSession) -> None:
    """Marca como `expirado` los informes cuyo enlace ya venció."""
    resultado = await db.execute(
        select(ReportJob).where(
            ReportJob.status == ReportStatus.LISTO,
            ReportJob.expires_at.is_not(None),
            ReportJob.expires_at < _ahora(),
        )
    )
    vencidos = resultado.scalars().all()
    if not vencidos:
        return
    for job in vencidos:
        job.status = ReportStatus.EXPIRADO
    await db.commit()


def _descarga_disponible(job: ReportJob) -> bool:
    if job.status != ReportStatus.LISTO or not job.file_path:
        return False
    if job.expires_at and _aware(job.expires_at) <= _ahora():
        return False
    return True


def serializar_job(job: ReportJob, solicitante: str) -> ReportOut:
    expirado = job.status == ReportStatus.EXPIRADO
    disponible = _descarga_disponible(job)
    return ReportOut(
        id=job.id,
        name=job.name,
        tipo=job.tipo,
        tipo_label=ETIQUETAS_TIPO.get(job.tipo, job.tipo),
        formato=job.formato,
        status=job.status,
        status_label=ETIQUETAS_ESTADO.get(job.status, job.status),
        source=job.source,
        requested_by=job.requested_by,
        requested_by_name=solicitante,
        corte=job.corte,
        params=job.params or {},
        row_count=job.row_count,
        file_size=job.file_size,
        error=job.error,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        expires_at=job.expires_at,
        expirado=expirado,
        descarga_disponible=disponible,
        download_url=f"/api/v1/reports/{job.id}/download" if disponible else None,
    )


async def _nombres_solicitantes(db: AsyncSession, ids: set[str]) -> dict[str, str]:
    if not ids:
        return {}
    resultado = await db.execute(select(User.id, User.full_name).where(User.id.in_(ids)))
    return {fila[0]: fila[1] for fila in resultado.all()}


async def listar_reportes(
    db: AsyncSession,
    actor: User,
    *,
    tipo: str | None = None,
    estado: str | None = None,
    solicitante: str | None = None,
    pagina: int = 1,
    tamano: int = 10,
) -> ReportListOut:
    await marcar_expirados(db)

    consulta = select(ReportJob, User.full_name).join(User, User.id == ReportJob.requested_by)
    if tipo:
        consulta = consulta.where(ReportJob.tipo == tipo)
    if estado:
        consulta = consulta.where(ReportJob.status == estado)
    if solicitante == "mios":
        consulta = consulta.where(ReportJob.requested_by == actor.id)
    elif solicitante:
        consulta = consulta.where(ReportJob.requested_by == solicitante)
    consulta = consulta.order_by(ReportJob.created_at.desc())

    filas = (await db.execute(consulta)).all()
    serializados = [serializar_job(job, nombre) for job, nombre in filas]

    total = len(serializados)
    inicio = (pagina - 1) * tamano
    return ReportListOut(
        items=serializados[inicio : inicio + tamano],
        total=total,
        page=pagina,
        page_size=tamano,
        resumen=_resumen(serializados),
        por_tipo_estado=_por_tipo_estado(serializados),
    )


def _resumen(items: list[ReportOut]) -> ReportResumenOut:
    limite = _ahora() + timedelta(hours=UMBRAL_POR_EXPIRAR_HORAS)
    return ReportResumenOut(
        total=len(items),
        generados=sum(1 for i in items if i.status == ReportStatus.LISTO),
        en_proceso=sum(
            1 for i in items if i.status in (ReportStatus.PENDIENTE, ReportStatus.EN_PROCESO)
        ),
        fallidos=sum(1 for i in items if i.status == ReportStatus.FALLIDO),
        por_expirar=sum(
            1
            for i in items
            if i.status == ReportStatus.LISTO
            and i.expires_at
            and _aware(i.expires_at) <= limite
        ),
    )


def _por_tipo_estado(items: list[ReportOut]) -> list[ReportTipoEstadoOut]:
    salida: list[ReportTipoEstadoOut] = []
    for tipo, etiqueta in ETIQUETAS_TIPO.items():
        estados = {clave: 0 for clave in ETIQUETAS_ESTADO}
        total = 0
        for item in items:
            if item.tipo != tipo:
                continue
            estados[item.status] = estados.get(item.status, 0) + 1
            total += 1
        salida.append(
            ReportTipoEstadoOut(tipo=tipo, tipo_label=etiqueta, estados=estados, total=total)
        )
    return salida


async def obtener_reporte(db: AsyncSession, actor: User, report_id: str) -> ReportOut:
    await marcar_expirados(db)
    job = await db.get(ReportJob, report_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Informe no encontrado.")
    if job.requested_by != actor.id and not _es_admin(actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el solicitante o un Administrador pueden ver este informe.",
        )
    nombres = await _nombres_solicitantes(db, {job.requested_by})
    return serializar_job(job, nombres.get(job.requested_by, ""))


async def preparar_descarga(db: AsyncSession, actor: User, report_id: str) -> tuple[Path, str, ReportJob]:
    """Valida acceso, estado y expiración y devuelve la ruta del archivo."""
    await marcar_expirados(db)
    job = await db.get(ReportJob, report_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Informe no encontrado.")
    if job.requested_by != actor.id and not _es_admin(actor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el solicitante o un Administrador pueden descargar este informe.",
        )
    if job.status == ReportStatus.EXPIRADO:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="El enlace del informe expiró; solicítelo de nuevo.",
        )
    if job.status == ReportStatus.LISTO and not _descarga_disponible(job):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="El enlace del informe expiró; solicítelo de nuevo.",
        )
    if job.status != ReportStatus.LISTO:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El informe todavía no está listo.",
        )
    if not job.file_path or not Path(job.file_path).is_file():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="El archivo del informe ya no está disponible.",
        )

    registrar_auditoria(
        actor_id=actor.id,
        action="reporte_descargado",
        entity_type="report_job",
        entity_id=job.id,
        after={"formato": job.formato, "filas": job.row_count},
    )
    nombre_archivo = f"{Path(job.file_path).name}"
    return Path(job.file_path), nombre_archivo, job


__all__ = [
    "ETIQUETAS_TIPO",
    "ETIQUETAS_ESTADO",
    "TTL_HORAS",
    "FORMATOS_VALIDOS",
    "crear_reporte",
    "generar_reporte",
    "generar_en_background",
    "listar_tipos",
    "listar_reportes",
    "obtener_reporte",
    "preparar_descarga",
    "serializar_job",
]
