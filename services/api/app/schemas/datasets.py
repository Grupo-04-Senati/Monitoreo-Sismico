"""Esquemas del módulo "Preparación de datos" (6.5)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

#: Variables que un dataset puede declarar (columnas de `seismic_events`).
VARIABLES_DISPONIBLES = (
    "occurred_at",
    "latitude",
    "longitude",
    "depth_km",
    "magnitude",
    "magnitude_type",
)


class ReglasLimpiezaIn(BaseModel):
    magnitud_minima: float | None = Field(default=None, ge=0, le=10)
    solo_revisados: bool = False
    tipos_magnitud: list[Literal["Mw", "ML", "mb"]] | None = None
    sin_profundidad: Literal["excluir", "imputar_mediana", "conservar"] = "conservar"
    posibles_duplicados: Literal["excluir", "conservar"] = "conservar"


class DatasetCreateIn(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    #: Clave de la fuente (p. ej. "usgs"); por defecto, todas.
    fuente: str | None = Field(default=None, max_length=32)
    #: Periodo (UTC), ambos días incluidos.
    desde: date
    hasta: date
    reglas: ReglasLimpiezaIn = Field(default_factory=ReglasLimpiezaIn)
    variables: list[Literal[VARIABLES_DISPONIBLES]] = Field(min_length=1)  # type: ignore[valid-type]
    variable_objetivo: Literal[VARIABLES_DISPONIBLES] | None = None  # type: ignore[valid-type]
    #: Partición temporal: entrenamiento antes de este día, prueba desde este día.
    fecha_corte: date | None = None

    @model_validator(mode="after")
    def _coherencia(self) -> "DatasetCreateIn":
        if self.desde > self.hasta:
            raise ValueError("'desde' debe ser anterior o igual a 'hasta'")
        if self.fecha_corte is not None and not (self.desde < self.fecha_corte <= self.hasta):
            raise ValueError("'fecha_corte' debe caer dentro del periodo (después de 'desde')")
        if len(set(self.variables)) != len(self.variables):
            raise ValueError("'variables' no puede repetir columnas")
        if self.variable_objetivo and self.variable_objetivo in self.variables:
            raise ValueError("la variable objetivo no puede estar también entre las variables")
        return self


class DatasetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    version: int
    description: str | None
    status: str
    source_id: str | None
    period_start: datetime
    period_end: datetime
    query_spec: dict[str, Any]
    cleaning_rules: dict[str, Any]
    variables: list[str]
    target_name: str | None
    split_date: datetime | None
    row_count: int
    quality_report: dict[str, Any]
    created_by: str
    created_at: datetime
    approved_by: str | None
    approved_at: datetime | None


class DatasetListOut(BaseModel):
    items: list[DatasetOut]
    total: int
    page: int
    page_size: int


class DatasetQualityOut(BaseModel):
    dataset_id: str
    name: str
    version: int
    status: str
    quality_report: dict[str, Any]


class DatasetRowOut(BaseModel):
    event_id: str
    external_id: str
    split: str | None
    occurred_at: datetime
    latitude: float
    longitude: float
    depth_km: float | None
    #: True si `depth_km` viene de la imputación del dataset (no del catálogo).
    depth_imputada: bool
    magnitude: float | None
    magnitude_type: str | None
    review_status: str


class DatasetRowsOut(BaseModel):
    items: list[DatasetRowOut]
    total: int
    page: int
    page_size: int
