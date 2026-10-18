"""Normalizador para el formato del IGP (JSON).

Mapea el payload crudo a `NormalizedEvent`, aplicando las reglas de validación y
calculando `origin_hash`. Los campos que falten o sean inválidos provocan el
rechazo del registro (no se inserta), pero no cortan la sincronización.
"""

from __future__ import annotations

from datetime import datetime, timezone

from ingestion.connectors.base import RawRecord
from ingestion.models import NormalizedEvent
from ingestion.normalizers.base import NormalizationResult
from ingestion.validation import origin_hash, validar


def _a_float(valor) -> float | None:
    if valor is None or valor == "":
        return None
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None


def _a_datetime(valor) -> datetime | None:
    if not valor:
        return None
    try:
        texto = str(valor).replace("Z", "+00:00")
        momento = datetime.fromisoformat(texto)
    except ValueError:
        return None
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=timezone.utc)
    return momento.astimezone(timezone.utc)


class IgpNormalizer:
    """Normalizador del proveedor IGP."""

    def __init__(self, source_key: str = "igp") -> None:
        self.source_key = source_key

    def normalize(self, raw: RawRecord) -> NormalizationResult:
        payload = raw.payload

        occurred_at = _a_datetime(payload.get("occurred_at") or payload.get("fecha_hora_evento"))
        if occurred_at is None:
            return NormalizationResult(motivo="fecha de evento ausente o inválida")

        latitude = _a_float(payload.get("latitude", payload.get("latitud")))
        longitude = _a_float(payload.get("longitude", payload.get("longitud")))
        depth_km = _a_float(payload.get("depth_km", payload.get("profundidad_km")))
        magnitude = _a_float(payload.get("magnitude", payload.get("magnitud")))

        motivo = validar(
            latitude=latitude, longitude=longitude, magnitude=magnitude, depth_km=depth_km
        )
        if motivo is not None:
            return NormalizationResult(motivo=motivo)

        external_id = str(payload.get("external_id") or raw.external_id)
        region = payload.get("region") or None
        mag_type = payload.get("magnitude_type") or payload.get("tipo_magnitud") or None
        locality = payload.get("locality") or payload.get("lugar") or payload.get("place") or None
        source_url = payload.get("source_url") or payload.get("url") or payload.get("enlace") or None
        revisado = payload.get("review_status") or payload.get("estado_revision") or "observado"
        if revisado not in ("observado", "pendiente_validacion"):
            revisado = "observado"

        received_at = _a_datetime(payload.get("received_at"))

        evento = NormalizedEvent(
            external_id=external_id,
            occurred_at=occurred_at,
            latitude=latitude,  # type: ignore[arg-type]
            longitude=longitude,  # type: ignore[arg-type]
            depth_km=depth_km,
            magnitude=magnitude,
            magnitude_type=str(mag_type) if mag_type else None,
            region=str(region) if region else None,
            locality=str(locality) if locality else None,
            source_url=str(source_url) if source_url else None,
            review_status=str(revisado),
            received_at=received_at,
            origin_hash=origin_hash(
                source_key=self.source_key,
                external_id=external_id,
                occurred_at=occurred_at,
                latitude=latitude,  # type: ignore[arg-type]
                longitude=longitude,  # type: ignore[arg-type]
                depth_km=depth_km,
                magnitude=magnitude,
            ),
            raw=dict(payload),
        )
        return NormalizationResult(event=evento)


__all__ = ["IgpNormalizer"]
