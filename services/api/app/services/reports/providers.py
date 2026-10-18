"""Proveedores de reportes disponibles en el MVP.

- **Eventos sísmicos**, **Calidad de datos** y **Fuentes e ingesta** se generan
  con los datos ya ingeridos.
- **Modelos ML** y **Alertas** dependen de módulos que aún no existen; registran
  un proveedor con `disponible = False` para que la interfaz los muestre como
  "Disponible próximamente".
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DataSource, IngestionRun, SeismicEvent
from app.services.reports.base import ReportData, ReportParams


def _inicio(dia: date) -> datetime:
    return datetime.combine(dia, time.min, tzinfo=timezone.utc)


def _fin(dia: date) -> datetime:
    return datetime.combine(dia, time.max, tzinfo=timezone.utc)


def _fmt_utc5(valor: datetime | None) -> str:
    if valor is None:
        return ""
    if valor.tzinfo is None:
        valor = valor.replace(tzinfo=timezone.utc)
    return (valor - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M")


def _texto(valor: Any) -> str:
    if valor is None:
        return ""
    if isinstance(valor, float):
        return f"{valor:.4f}"
    return str(valor)


class EventosProvider:
    tipo = "eventos"
    etiqueta = "Eventos sísmicos"
    disponible = True
    formatos = ("csv", "xlsx", "pdf")

    async def generar(self, db: AsyncSession, params: ReportParams) -> ReportData:
        filtros = params.filtros
        desde = params.desde or params.corte
        hasta = params.hasta or params.corte

        consulta = (
            select(SeismicEvent, DataSource.name)
            .join(DataSource, DataSource.id == SeismicEvent.source_id)
            .where(SeismicEvent.occurred_at >= _inicio(desde))
            .where(SeismicEvent.occurred_at <= _fin(hasta))
            .order_by(SeismicEvent.occurred_at)
        )
        if params.zona:
            consulta = consulta.where(SeismicEvent.region == params.zona)
        magnitud_min = filtros.get("magnitud_min")
        if magnitud_min is not None:
            consulta = consulta.where(SeismicEvent.magnitude >= float(magnitud_min))
        review = filtros.get("review_status")
        if review:
            consulta = consulta.where(SeismicEvent.review_status == review)

        registros = (await db.execute(consulta)).all()
        filas = [
            [
                evento.external_id,
                _fmt_utc5(evento.occurred_at),
                _texto(evento.latitude),
                _texto(evento.longitude),
                _texto(evento.depth_km),
                _texto(evento.magnitude),
                _texto(evento.magnitude_type),
                _texto(evento.region),
                _texto(evento.locality),
                _texto(evento.review_status),
                nombre_fuente,
            ]
            for evento, nombre_fuente in registros
        ]
        fuente = registros[0][1] if registros else "—"
        return ReportData(
            nombre="Eventos sísmicos",
            columnas=[
                "Evento", "Fecha y hora (UTC-5)", "Latitud", "Longitud",
                "Profundidad (km)", "Magnitud", "Tipo", "Región", "Localidad",
                "Estado de revisión", "Fuente",
            ],
            filas=filas,
            fuente=fuente,
            metadatos=_metadatos(params, len(filas), fuente),
        )


class CalidadProvider:
    tipo = "calidad_datos"
    etiqueta = "Calidad de datos"
    disponible = True
    formatos = ("csv", "xlsx", "pdf")

    async def generar(self, db: AsyncSession, params: ReportParams) -> ReportData:
        desde = params.desde or params.corte
        hasta = params.hasta or params.corte
        consulta = (
            select(IngestionRun, DataSource.name)
            .join(DataSource, DataSource.id == IngestionRun.source_id)
            .where(IngestionRun.started_at >= _inicio(desde))
            .where(IngestionRun.started_at <= _fin(hasta))
            .order_by(IngestionRun.started_at)
        )
        registros = (await db.execute(consulta)).all()
        filas = [
            [
                run.id,
                _fmt_utc5(run.started_at),
                run.status,
                str(run.records_read),
                str(run.records_inserted),
                str(run.duplicates_skipped),
                str(run.attempts),
                _texto(run.latency_ms),
                _texto(run.error_summary),
            ]
            for run, _nombre in registros
        ]
        leidos = sum(run.records_read for run, _ in registros)
        insertados = sum(run.records_inserted for run, _ in registros)
        duplicados = sum(run.duplicates_skipped for run, _ in registros)
        metadatos = _metadatos(params, len(filas), "Ingesta")
        metadatos.extend(
            [
                ("Registros leídos", str(leidos)),
                ("Registros insertados", str(insertados)),
                ("Duplicados omitidos", str(duplicados)),
                (
                    "Tasa de duplicados",
                    f"{(duplicados / leidos * 100):.2f} %" if leidos else "0.00 %",
                ),
            ]
        )
        return ReportData(
            nombre="Calidad de datos",
            columnas=[
                "Ejecución", "Inicio (UTC-5)", "Estado", "Leídos", "Insertados",
                "Duplicados", "Intentos", "Latencia (ms)", "Error",
            ],
            filas=filas,
            fuente="Ingesta",
            metadatos=metadatos,
        )


class FuentesProvider:
    tipo = "fuentes_ingesta"
    etiqueta = "Fuentes e ingesta"
    disponible = True
    formatos = ("csv", "xlsx", "pdf")

    async def generar(self, db: AsyncSession, params: ReportParams) -> ReportData:
        fuentes = (await db.execute(select(DataSource).order_by(DataSource.created_at))).scalars().all()
        filas = [
            [
                fuente.name,
                fuente.organization,
                fuente.kind,
                _texto(fuente.url_api),
                f"{fuente.frequency_min} min",
                str(fuente.retries),
                f"{fuente.timeout_sec} s",
                "Sí" if fuente.enabled else "No",
                _texto(fuente.license) or "Por definir",
                _texto(fuente.contact) or "Por definir",
                _texto(fuente.usage_limits) or "Por definir",
            ]
            for fuente in fuentes
        ]
        fuente = fuentes[0].name if fuentes else "—"
        return ReportData(
            nombre="Fuentes e ingesta",
            columnas=[
                "Fuente", "Organización", "Tipo", "URL", "Frecuencia",
                "Reintentos", "Tiempo límite", "Habilitada", "Licencia",
                "Contacto", "Límites de uso",
            ],
            filas=filas,
            fuente=fuente,
            metadatos=_metadatos(params, len(filas), fuente),
        )


class ProveedorNoDisponible:
    """Proveedor provisional para los módulos externos (Modelos ML, Alertas)."""

    formatos = ("csv", "xlsx", "pdf")

    def __init__(self, tipo: str, etiqueta: str) -> None:
        self.tipo = tipo
        self.etiqueta = etiqueta
        self.disponible = False

    async def generar(self, db: AsyncSession, params: ReportParams) -> ReportData:
        raise RuntimeError(f"El informe de {self.etiqueta} estará disponible próximamente.")


def _metadatos(params: ReportParams, filas: int, fuente: str) -> list[tuple[str, str]]:
    """Cabecera común: fecha de corte, filtros, fuente y solicitante."""
    valores: list[tuple[str, str]] = [
        ("Fecha de corte", params.corte.isoformat()),
        ("Periodo", params.periodo or _rango_texto(params)),
    ]
    if params.zona:
        valores.append(("Zona", params.zona))
    filtros = {k: v for k, v in params.filtros.items() if v not in (None, "", [])}
    if filtros:
        valores.append(("Filtros", ", ".join(f"{k}={v}" for k, v in filtros.items())))
    valores.append(("Fuente", fuente))
    valores.append(("Solicitante", params.solicitante or "—"))
    valores.append(("Filas", str(filas)))
    return valores


def _rango_texto(params: ReportParams) -> str:
    if params.desde and params.hasta:
        return f"{params.desde.isoformat()} a {params.hasta.isoformat()}"
    return "Histórico completo"


PROVIDERS: tuple[Any, ...] = (
    EventosProvider(),
    CalidadProvider(),
    FuentesProvider(),
    ProveedorNoDisponible("modelos", "Modelos ML"),
    ProveedorNoDisponible("alertas", "Alertas"),
)

__all__ = ["PROVIDERS", "EventosProvider", "CalidadProvider", "FuentesProvider"]
