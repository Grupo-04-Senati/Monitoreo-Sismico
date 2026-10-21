"""Esquemas del módulo "Modelos de Machine Learning" (6.6)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

#: Tareas disponibles (ver `services/ml/training`).
TAREAS = ("conteo_semanal", "regresion_lineal")


class ExperimentCreateIn(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    task_type: Literal[TAREAS]  # type: ignore[valid-type]
    #: Debe ser un dataset **aprobado** (inmutable).
    dataset_id: str = Field(min_length=1, max_length=36)
    semilla: int = Field(default=42, ge=0, le=2**31 - 1)


class ExperimentOut(BaseModel):
    # `model_id` es un campo propio, no del espacio reservado de Pydantic.
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: str
    name: str
    task_type: str
    algorithm: str | None
    dataset_id: str
    feature_spec: list[str]
    target_name: str | None
    params: dict[str, Any]
    metrics: dict[str, Any]
    validation_spec: dict[str, Any]
    results: dict[str, Any]
    warnings: list[str]
    limitations: list[str]
    seed: int
    library_versions: dict[str, str]
    status: str
    error: str | None
    artifact_uri: str | None
    created_by: str
    created_at: datetime
    #: Si ya existe un modelo aprobado a partir de este experimento.
    model_id: str | None = None


class ExperimentListOut(BaseModel):
    items: list[ExperimentOut]
    total: int
    page: int
    page_size: int


class ApproveModelIn(BaseModel):
    #: Limitaciones adicionales que el Administrador quiere dejar en la ficha.
    limitaciones: str | None = Field(default=None, max_length=1000)


class ModelOut(BaseModel):
    id: str
    experiment_id: str
    name: str
    version: int
    status: str
    task_type: str
    algorithm: str | None
    dataset_id: str
    metrics: dict[str, Any]
    approved_by: str
    approved_at: datetime
    limitations: str


class ModelListOut(BaseModel):
    items: list[ModelOut]
    total: int
