"""Esquemas Pydantic del módulo "Fuentes de datos" (6.10).

Nunca se expone el valor de una credencial: solo su referencia (`config_ref`).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SourceOut(BaseModel):
    id: str
    key: str
    name: str
    organization: str
    kind: str
    url_api: str | None = None
    config_ref: str
    frequency_min: int
    retries: int
    timeout_sec: int
    enabled: bool
    idempotent: bool
    notify_errors: bool
    usage_limits: str | None = None
    license: str | None = None
    contact: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class SourceConfigIn(BaseModel):
    """Configuración editable por un Administrador. Todo opcional (PATCH-like)."""

    frequency_min: int | None = Field(default=None, ge=1, le=1440)
    retries: int | None = Field(default=None, ge=0, le=10)
    timeout_sec: int | None = Field(default=None, ge=1, le=600)
    enabled: bool | None = None
    idempotent: bool | None = None
    notify_errors: bool | None = None
    url_api: str | None = Field(default=None, max_length=255)
    usage_limits: str | None = Field(default=None, max_length=255)
    license: str | None = Field(default=None, max_length=255)
    contact: str | None = Field(default=None, max_length=255)


class SummaryOut(BaseModel):
    estado_conector: str
    estado_conector_detalle: str
    ultimo_exito: datetime | None = None
    latencia_media_ms: int
    tasa_exito_pct: float
    registros_insertados: int
    duplicados_omitidos: int


class HourlyPointOut(BaseModel):
    hora: str
    ejecuciones: int
    correctas: int
    con_errores: int
    fallidas: int
    pct_exito: float
    latencia_media_ms: int
    insertados: int
    duplicados: int


class RunOut(BaseModel):
    id: str
    source_id: str
    status: str
    triggered_by: str
    started_at: datetime
    finished_at: datetime | None = None
    duration_ms: int | None = None
    latency_ms: int | None = None
    http_status: int | None = None
    records_read: int
    records_inserted: int
    #: Correcciones de la fuente aplicadas (D27).
    records_updated: int = 0
    duplicates_skipped: int
    attempts: int
    error_summary: str | None = None
    correlation_id: str | None = None


class RunsPageOut(BaseModel):
    items: list[RunOut]
    total: int
    pagina: int
    tamano: int
    total_paginas: int


class QualityFieldOut(BaseModel):
    campo: str
    nulos: int
    porcentaje_nulos: float
    valor_ejemplo: str | None = None
    observacion: str | None = None


class QualityOut(BaseModel):
    campos: list[QualityFieldOut]
    total_eventos: int
    duplicados_omitidos: int
    frescura_min: int | None = None


class LogOut(BaseModel):
    id: int
    ts: datetime
    level: str
    message: str
    correlation_id: str | None = None
    run_id: str | None = None


class LogsPageOut(BaseModel):
    items: list[LogOut]
    total: int
    pagina: int
    tamano: int
    total_paginas: int


class SourceDetailOut(BaseModel):
    source: SourceOut
    summary: SummaryOut
    config: SourceOut
    por_hora: list[HourlyPointOut]


class SourceListOut(BaseModel):
    items: list[SourceOut]
    total: int


class SyncAcceptedOut(BaseModel):
    run_id: str
    status: str
    triggered_by: str
    correlation_id: str | None = None
    detalle: str


__all__ = [
    "SourceOut",
    "SourceConfigIn",
    "SummaryOut",
    "HourlyPointOut",
    "RunOut",
    "RunsPageOut",
    "QualityFieldOut",
    "QualityOut",
    "LogOut",
    "LogsPageOut",
    "SourceDetailOut",
    "SourceListOut",
    "SyncAcceptedOut",
]
