"""Normalizador del formato GeoJSON del USGS.

Mapeo (feature → `NormalizedEvent`):

- `id` → `external_id`
- `properties.time` (ms desde 1970, UTC) → `occurred_at`
- `geometry.coordinates` = [longitud, latitud, profundidad_km]
- `properties.mag` / `magType` → magnitud y tipo (`mww`→`Mw`, `ml`→`ML`, `mb`→`mb`;
  otros tipos se conservan tal cual)
- `properties.place` → `locality` (texto del USGS, en inglés)
- `properties.url` → `source_url`
- `properties.status`: `reviewed` → "observado"; `automatic` → "pendiente_validacion"

`region` (departamento del Perú) queda vacía: el USGS no la entrega y no se
inventa. Lo inválido se rechaza con su motivo, sin cortar la sincronización.
"""

from __future__ import annotations

from datetime import datetime, timezone

from ingestion.connectors.base import RawRecord
from ingestion.models import NormalizedEvent
from ingestion.normalizers.base import NormalizationResult
from ingestion.validation import origin_hash, validar


def _a_float(valor) -> float | None:
    if valor is None or isinstance(valor, bool):
        return None
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None


def _desde_ms(valor) -> datetime | None:
    ms = _a_float(valor)
    if ms is None:
        return None
    try:
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    except (OverflowError, OSError, ValueError):
        return None


def tipo_magnitud(valor) -> str | None:
    """Normaliza el tipo de magnitud a los valores que filtra la API."""
    if not valor:
        return None
    texto = str(valor).strip()
    bajo = texto.lower()
    if bajo.startswith("mw"):
        return "Mw"
    if bajo.startswith("ml"):
        return "ML"
    if bajo.startswith("mb"):
        return "mb"
    return texto[:16]


class UsgsNormalizer:
    """Normalizador del proveedor USGS."""

    def __init__(self, source_key: str = "usgs") -> None:
        self.source_key = source_key

    def normalize(self, raw: RawRecord) -> NormalizationResult:
        feature = raw.payload
        props = feature.get("properties") or {}
        coords = (feature.get("geometry") or {}).get("coordinates") or []

        occurred_at = _desde_ms(props.get("time"))
        if occurred_at is None:
            return NormalizationResult(motivo="fecha de evento ausente o inválida")
        if len(coords) < 2:
            return NormalizationResult(motivo="coordenadas ausentes")

        longitude = _a_float(coords[0])
        latitude = _a_float(coords[1])
        depth_km = _a_float(coords[2]) if len(coords) > 2 else None
        magnitude = _a_float(props.get("mag"))

        motivo = validar(
            latitude=latitude, longitude=longitude, magnitude=magnitude, depth_km=depth_km
        )
        if motivo is not None:
            return NormalizationResult(motivo=motivo)

        external_id = str(feature.get("id") or raw.external_id)
        estado = "observado" if props.get("status") == "reviewed" else "pendiente_validacion"
        lugar = props.get("place") or None
        url = props.get("url") or None

        evento = NormalizedEvent(
            external_id=external_id,
            occurred_at=occurred_at,
            latitude=latitude,  # type: ignore[arg-type]
            longitude=longitude,  # type: ignore[arg-type]
            depth_km=depth_km,
            magnitude=magnitude,
            magnitude_type=tipo_magnitud(props.get("magType")),
            region=None,
            locality=str(lugar)[:160] if lugar else None,
            source_url=str(url)[:500] if url else None,
            review_status=estado,
            received_at=None,
            origin_hash=origin_hash(
                source_key=self.source_key,
                external_id=external_id,
                occurred_at=occurred_at,
                latitude=latitude,  # type: ignore[arg-type]
                longitude=longitude,  # type: ignore[arg-type]
                depth_km=depth_km,
                magnitude=magnitude,
            ),
            raw=dict(feature),
        )
        return NormalizationResult(event=evento)


__all__ = ["UsgsNormalizer", "tipo_magnitud"]
