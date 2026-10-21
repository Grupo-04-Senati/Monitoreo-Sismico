"""Esquemas del módulo "Estimaciones experimentales" (6.7)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class EstimateCreateIn(BaseModel):
    # `model_id` es un campo propio, no del espacio reservado de Pydantic.
    model_config = ConfigDict(protected_namespaces=())

    #: Modelo **aprobado** del registro (`model_registry.id`).
    model_id: str = Field(min_length=1, max_length=36)


class EstimateOut(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    #: Etiqueta fija: una estimación nunca es un evento observado ni una alerta.
    categoria: str = "estimacion_experimental"
    model_id: str
    model_name: str | None = None
    model_version: int | None = None
    algorithm: str | None = None
    area_code: str
    area_description: str
    window_start: datetime
    window_end: datetime
    metric_name: str
    value: float
    lower_bound: float
    upper_bound: float
    confidence_level: float
    method: str
    reference_value: float | None
    inputs: dict[str, Any]
    warnings: list[str]
    disclaimer: str
    calculated_at: datetime
    status: str
    created_by: str
    reviewed_by: str | None
    reviewed_at: datetime | None


class EstimateListOut(BaseModel):
    items: list[EstimateOut]
    total: int
    page: int
    page_size: int
    disclaimer: str
