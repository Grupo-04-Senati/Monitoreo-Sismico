"""Consultas y serialización del módulo "Fuentes de datos" (6.10).

Todos los indicadores (KPIs) y el resumen por hora salen de `ingestion_runs`;
la calidad se calcula sobre `seismic_events`. La API nunca devuelve el valor de
una credencial: solo su referencia.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now

from app.db.models import DataSource, IngestionLog, IngestionRun, RunStatus, SeismicEvent
from app.schemas.fuentes import (
    HourlyPointOut,
    LogOut,
    LogsPageOut,
    QualityFieldOut,
    QualityOut,
    RunOut,
    RunsPageOut,
    SourceOut,
    SummaryOut,
)

#: Zona horaria de presentación (Perú, UTC-5).
TZ_PE = timezone(timedelta(hours=-5))

#: Periodos admitidos por los filtros de ejecuciones y registro.
PERIODOS = {"1h": 1, "3h": 3, "12h": 12, "24h": 24, "7d": 168}

#: Campos evaluados en el reporte de calidad (columna y etiqueta).
_CAMPOS_CALIDAD: list[tuple[str, object]] = [
    ("identificador_externo", SeismicEvent.external_id),
    ("fecha_hora_evento", SeismicEvent.occurred_at),
    ("latitud", SeismicEvent.latitude),
    ("longitud", SeismicEvent.longitude),
    ("magnitud", SeismicEvent.magnitude),
    ("profundidad_km", SeismicEvent.depth_km),
    ("region", SeismicEvent.region),
    ("tipo_magnitud", SeismicEvent.magnitude_type),
]


def serializar_fuente(source: DataSource) -> SourceOut:
    return SourceOut(
        id=source.id,
        key=source.key,
        name=source.name,
        organization=source.organization,
        kind=source.kind,
        url_api=source.url_api,
        config_ref=source.config_ref,
        frequency_min=source.frequency_min,
        retries=source.retries,
        timeout_sec=source.timeout_sec,
        enabled=source.enabled,
        idempotent=source.idempotent,
        notify_errors=source.notify_errors,
        usage_limits=source.usage_limits,
        license=source.license,
        contact=source.contact,
        created_at=source.created_at,
        updated_at=source.updated_at,
    )


def serializar_run(run: IngestionRun) -> RunOut:
    return RunOut(
        id=run.id,
        source_id=run.source_id,
        status=run.status,
        triggered_by=run.triggered_by,
        started_at=run.started_at,
        finished_at=run.finished_at,
        duration_ms=run.duration_ms,
        latency_ms=run.latency_ms,
        http_status=run.http_status,
        records_read=run.records_read,
        records_inserted=run.records_inserted,
        records_updated=run.records_updated or 0,
        duplicates_skipped=run.duplicates_skipped,
        attempts=run.attempts,
        error_summary=run.error_summary,
        correlation_id=run.correlation_id,
    )


def _desde(periodo: str | None) -> datetime | None:
    """Inicio de la ventana del periodo, referido a la última marca :00/:15/:30/:45."""
    horas = PERIODOS.get(periodo or "", None)
    if horas is None:
        return None
    ahora = clock_now()
    base = ahora.replace(minute=(ahora.minute // 15) * 15, second=0, microsecond=0)
    return base - timedelta(hours=horas)


async def listar_runs(db: AsyncSession, source_id: str, *_, limite: int = 500) -> list[IngestionRun]:
    stmt = (
        select(IngestionRun)
        .where(IngestionRun.source_id == source_id)
        .order_by(IngestionRun.started_at.desc())
        .limit(limite)
    )
    return list((await db.execute(stmt)).scalars().all())


def calcular_resumen(runs: list[IngestionRun]) -> SummaryOut:
    """KPIs del conector, calculados a partir de las ejecuciones."""
    finalizadas = [r for r in runs if r.status != RunStatus.EN_CURSO]
    exitosas = [r for r in finalizadas if r.status in (RunStatus.CORRECTA, RunStatus.CON_ERRORES)]
    con_latencia = [r for r in finalizadas if r.status != RunStatus.FALLIDA and r.latency_ms is not None]

    tasa = round(len(exitosas) / len(finalizadas) * 100, 1) if finalizadas else 0.0
    latencia = (
        round(sum(r.latency_ms for r in con_latencia) / len(con_latencia))  # type: ignore[misc]
        if con_latencia
        else 0
    )
    insertados = sum(r.records_inserted for r in runs)
    corregidos = sum(r.records_updated or 0 for r in runs)
    duplicados = sum(r.duplicates_skipped for r in runs)

    recientes = finalizadas[:8]
    ultimo_exito = next(
        (r for r in finalizadas if r.status in (RunStatus.CORRECTA, RunStatus.CON_ERRORES)), None
    )
    ultimo_exito_ts = None
    if ultimo_exito is not None:
        ultimo_exito_ts = ultimo_exito.finished_at or ultimo_exito.started_at

    if not finalizadas:
        estado, detalle = "sin_datos", "Sin ejecuciones registradas."
    elif recientes and recientes[0].status == RunStatus.FALLIDA:
        estado, detalle = "sin_conexion", "La última ejecución falló; reintento en curso."
    elif any(r.status == RunStatus.FALLIDA for r in recientes):
        estado, detalle = "degradado", "Fallo reciente; el resto de ejecuciones es correcto."
    elif recientes[0].status == RunStatus.CON_ERRORES:
        # Registros inválidos descartados: la validación funcionó, pero la última
        # entrega de la fuente trajo datos con problemas. Una vez que llega una
        # ejecución limpia deja de contar (no es una caída de la fuente).
        estado, detalle = "degradado", "La última ejecución descartó registros inválidos de la fuente."
    else:
        estado, detalle = "operativo", "Sincronización al día sin incidencias."

    return SummaryOut(
        estado_conector=estado,
        estado_conector_detalle=detalle,
        ultimo_exito=ultimo_exito_ts,
        latencia_media_ms=latencia,
        tasa_exito_pct=tasa,
        registros_insertados=insertados,
        registros_corregidos=corregidos,
        duplicados_omitidos=duplicados,
    )


def calcular_por_hora(runs: list[IngestionRun], horas: int = 12) -> list[HourlyPointOut]:
    """Resumen por hora (UTC-5), ascendente, a partir de las ejecuciones."""
    desde = clock_now() - timedelta(hours=horas)
    en_ventana = [r for r in runs if r.started_at >= desde]

    agrupado: dict[datetime, list[IngestionRun]] = {}
    for r in en_ventana:
        clave = r.started_at.astimezone(TZ_PE).replace(minute=0, second=0, microsecond=0)
        agrupado.setdefault(clave, []).append(r)

    puntos: list[HourlyPointOut] = []
    for clave in sorted(agrupado):
        lista = agrupado[clave]
        finalizadas = [r for r in lista if r.status != RunStatus.EN_CURSO]
        correctas = sum(1 for r in finalizadas if r.status == RunStatus.CORRECTA)
        con_errores = sum(1 for r in finalizadas if r.status == RunStatus.CON_ERRORES)
        fallidas = sum(1 for r in finalizadas if r.status == RunStatus.FALLIDA)
        con_lat = [r.latency_ms for r in finalizadas if r.status != RunStatus.FALLIDA and r.latency_ms is not None]
        puntos.append(
            HourlyPointOut(
                hora=f"{clave:%H}:00",
                ejecuciones=len(lista),
                correctas=correctas,
                con_errores=con_errores,
                fallidas=fallidas,
                pct_exito=round((correctas + con_errores) / len(finalizadas) * 100, 1) if finalizadas else 0.0,
                latencia_media_ms=round(sum(con_lat) / len(con_lat)) if con_lat else 0,
                insertados=sum(r.records_inserted for r in lista),
                duplicados=sum(r.duplicates_skipped for r in lista),
            )
        )
    return puntos


async def calcular_calidad(db: AsyncSession, source_id: str) -> QualityOut:
    etiquetas = [func.count(col).label(f"c{i}") for i, (_, col) in enumerate(_CAMPOS_CALIDAD)]
    fila = (
        await db.execute(
            select(func.count().label("total"), *etiquetas)
            .select_from(SeismicEvent)
            .where(SeismicEvent.source_id == source_id)
        )
    ).one()
    total = int(fila.total)

    ultimo = (
        await db.execute(
            select(SeismicEvent)
            .where(SeismicEvent.source_id == source_id)
            .order_by(SeismicEvent.occurred_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    campos: list[QualityFieldOut] = []
    for i, (nombre, col) in enumerate(_CAMPOS_CALIDAD):
        presentes = int(getattr(fila, f"c{i}"))
        nulos = max(0, total - presentes)
        pct = round(nulos / total * 100, 1) if total else 0.0
        valor = _valor_ejemplo(nombre, ultimo) if ultimo is not None else None
        observacion = None
        if nombre == "profundidad_km" and pct > 0:
            observacion = "Revisar valores de profundidad nulos o fuera de rango."
        if nombre == "tipo_magnitud" and pct > 0:
            observacion = "El proveedor no siempre informa el tipo de magnitud."
        campos.append(
            QualityFieldOut(
                campo=nombre, nulos=nulos, porcentaje_nulos=pct, valor_ejemplo=valor, observacion=observacion
            )
        )

    duplicados = int(
        (await db.execute(
            select(func.coalesce(func.sum(IngestionRun.duplicates_skipped), 0)).where(
                IngestionRun.source_id == source_id
            )
        )).scalar_one()
    )
    maxima = (
        await db.execute(select(func.max(SeismicEvent.occurred_at)).where(SeismicEvent.source_id == source_id))
    ).scalar_one()
    frescura = None
    if maxima is not None:
        frescura = max(0, round((clock_now() - maxima).total_seconds() / 60))

    return QualityOut(
        campos=campos, total_eventos=total, duplicados_omitidos=duplicados, frescura_min=frescura
    )


def _valor_ejemplo(nombre: str, evento: SeismicEvent) -> str | None:
    if nombre == "identificador_externo":
        return evento.external_id
    if nombre == "fecha_hora_evento":
        return evento.occurred_at.isoformat()
    if nombre == "latitud":
        return f"{evento.latitude:.4f}"
    if nombre == "longitud":
        return f"{evento.longitude:.4f}"
    if nombre == "magnitud":
        return None if evento.magnitude is None else f"{evento.magnitude:.1f}"
    if nombre == "profundidad_km":
        return None if evento.depth_km is None else f"{evento.depth_km:.0f}"
    if nombre == "region":
        return evento.region
    if nombre == "tipo_magnitud":
        return evento.magnitude_type
    return None


async def pagina_runs(
    db: AsyncSession,
    source_id: str,
    *,
    estado: str | None,
    periodo: str | None,
    q: str | None,
    pagina: int,
    tamano: int,
) -> RunsPageOut:
    condiciones = [IngestionRun.source_id == source_id]
    if estado:
        condiciones.append(IngestionRun.status == estado)
    desde = _desde(periodo)
    if desde is not None:
        condiciones.append(IngestionRun.started_at >= desde)
    if q:
        patron = f"%{q.strip().lower()}%"
        condiciones.append(
            or_(
                func.lower(IngestionRun.id).like(patron),
                func.lower(func.coalesce(IngestionRun.error_summary, "")).like(patron),
            )
        )

    total = int(
        (await db.execute(select(func.count()).select_from(IngestionRun).where(*condiciones))).scalar_one()
    )
    stmt = (
        select(IngestionRun)
        .where(*condiciones)
        .order_by(IngestionRun.started_at.desc())
        .offset((pagina - 1) * tamano)
        .limit(tamano)
    )
    runs = list((await db.execute(stmt)).scalars().all())
    total_paginas = max(1, (total + tamano - 1) // tamano)
    return RunsPageOut(
        items=[serializar_run(r) for r in runs],
        total=total,
        pagina=pagina,
        tamano=tamano,
        total_paginas=total_paginas,
    )


async def pagina_logs(
    db: AsyncSession,
    source_id: str,
    *,
    nivel: str | None,
    texto: str | None,
    periodo: str | None,
    pagina: int,
    tamano: int,
) -> LogsPageOut:
    condiciones = [IngestionLog.source_id == source_id]
    if nivel:
        condiciones.append(IngestionLog.level == nivel.upper())
    if texto:
        condiciones.append(func.lower(IngestionLog.message).like(f"%{texto.strip().lower()}%"))
    desde = _desde(periodo)
    if desde is not None:
        condiciones.append(IngestionLog.ts >= desde)

    total = int(
        (await db.execute(select(func.count()).select_from(IngestionLog).where(*condiciones))).scalar_one()
    )
    stmt = (
        select(IngestionLog)
        .where(*condiciones)
        .order_by(IngestionLog.ts.desc(), IngestionLog.id.desc())
        .offset((pagina - 1) * tamano)
        .limit(tamano)
    )
    logs = list((await db.execute(stmt)).scalars().all())
    total_paginas = max(1, (total + tamano - 1) // tamano)
    return LogsPageOut(
        items=[
            LogOut(
                id=log.id,
                ts=log.ts,
                level=log.level,
                message=log.message,
                correlation_id=log.correlation_id,
                run_id=log.run_id,
            )
            for log in logs
        ],
        total=total,
        pagina=pagina,
        tamano=tamano,
        total_paginas=total_paginas,
    )


__all__ = [
    "TZ_PE",
    "PERIODOS",
    "serializar_fuente",
    "serializar_run",
    "listar_runs",
    "calcular_resumen",
    "calcular_por_hora",
    "calcular_calidad",
    "pagina_runs",
    "pagina_logs",
]
