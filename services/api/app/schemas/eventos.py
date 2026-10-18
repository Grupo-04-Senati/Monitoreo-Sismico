"""Esquemas Pydantic del módulo "Eventos sísmicos" (6.2).

El catálogo expone los eventos observados tal como los reporta la fuente, con su
procedencia (proveedor, identificador externo, URL, recepción y hash de origen).
`magnitude_type` puede ser `null` cuando el proveedor no lo informa; la interfaz
lo muestra como "—".
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class EventOut(BaseModel):
    id: str
    external_id: str
    occurred_at: datetime

    latitude: float
    longitude: float
    depth_km: float | None = None
    magnitude: float | None = None
    magnitude_type: str | None = None

    region: str | None = None
    locality: str | None = None
    review_status: str

    #: Procedencia del registro.
    source_id: str
    provider: str
    source_url: str | None = None
    received_at: datetime | None = None
    origin_hash: str


class EventDetailOut(EventOut):
    """Detalle de un evento: mismas claves de procedencia que el listado."""


class EventListOut(BaseModel):
    items: list[EventOut]
    total: int
    page: int
    page_size: int
    #: Fuente del catálogo (una sola en el MVP).
    source: str
    generated_at: datetime


# ══════════════════════════════════════════════════════════════════════════
# GeoJSON para el módulo "Mapa sísmico" (6.3)
# ══════════════════════════════════════════════════════════════════════════


class EventFeatureProperties(BaseModel):
    """Propiedades mínimas que necesita el mapa (puntos por evento)."""

    id: str
    magnitude: float | None = None
    magnitude_type: str | None = None
    depth_km: float | None = None
    region: str | None = None
    occurred_at: datetime
    source: str


class EventPointGeometry(BaseModel):
    """Geometría GeoJSON de un punto: `[longitud, latitud]` (orden del estándar)."""

    type: Literal["Point"] = "Point"
    coordinates: tuple[float, float]


class EventFeature(BaseModel):
    type: Literal["Feature"] = "Feature"
    geometry: EventPointGeometry
    properties: EventFeatureProperties


class EventGeoJSONOut(BaseModel):
    """FeatureCollection de eventos observados.

    El mapa **no** inventa geografía: solo dibuja los puntos reportados. La capa
    base (departamentos) la aporta el usuario como GeoJSON aparte.
    """

    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[EventFeature]
    count: int
    #: Fuente del catálogo (una sola en el MVP).
    source: str
    generated_at: datetime


__all__ = [
    "EventOut",
    "EventDetailOut",
    "EventListOut",
    "EventFeatureProperties",
    "EventPointGeometry",
    "EventFeature",
    "EventGeoJSONOut",
]
