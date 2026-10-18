"""Esquemas Pydantic del módulo "Reportes" (6.11).

El informe se describe con su estado, sus parámetros (filtros y fecha de corte,
para reproducirlo) y un enlace de descarga que **expira**. Nunca expone rutas
internas ni secretos.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ReportCreateIn(BaseModel):
    tipo: str = Field(description="eventos | calidad_datos | fuentes_ingesta | modelos | alertas")
    formato: str = Field(description="csv | xlsx | pdf")
    periodo: str | None = None
    desde: str | None = None
    hasta: str | None = None
    zona: str | None = None
    #: Filtros específicos del tipo (magnitud, profundidad, estado, etc.).
    filtros: dict[str, Any] = Field(default_factory=dict)


class ReportTypeOut(BaseModel):
    tipo: str
    etiqueta: str
    disponible: bool
    formatos: list[str]


class ReportTypesOut(BaseModel):
    items: list[ReportTypeOut]


class ReportOut(BaseModel):
    id: str
    name: str
    tipo: str
    tipo_label: str
    formato: str
    status: str
    status_label: str

    source: str
    requested_by: str
    requested_by_name: str

    corte: datetime
    params: dict[str, Any]

    row_count: int | None = None
    file_size: int | None = None
    error: str | None = None

    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    expires_at: datetime | None = None
    expirado: bool = False
    descarga_disponible: bool = False
    download_url: str | None = None


class ReportResumenOut(BaseModel):
    total: int
    generados: int
    en_proceso: int
    fallidos: int
    por_expirar: int


class ReportTipoEstadoOut(BaseModel):
    tipo: str
    tipo_label: str
    estados: dict[str, int]
    total: int


class ReportListOut(BaseModel):
    items: list[ReportOut]
    total: int
    page: int
    page_size: int
    resumen: ReportResumenOut
    por_tipo_estado: list[ReportTipoEstadoOut]


__all__ = [
    "ReportCreateIn",
    "ReportTypeOut",
    "ReportTypesOut",
    "ReportOut",
    "ReportResumenOut",
    "ReportTipoEstadoOut",
    "ReportListOut",
]
