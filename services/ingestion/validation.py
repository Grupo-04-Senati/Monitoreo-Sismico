"""Reglas de validación y huella de origen de un evento sísmico.

Centraliza los límites aceptables y el cálculo de `origin_hash`, de modo que la
misma validación se use al normalizar y al reconciliar duplicados.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone

#: Dominio geográfico plausible del Perú (con un margen para sismos de borde).
LAT_MIN, LAT_MAX = -18.6, 0.5
LON_MIN, LON_MAX = -81.6, -68.4

MAG_MIN, MAG_MAX = 0.0, 10.0
PROF_MIN, PROF_MAX = 0.0, 750.0


def validar(
    *,
    latitude: float | None,
    longitude: float | None,
    magnitude: float | None,
    depth_km: float | None = None,
) -> str | None:
    """Devuelve el motivo del rechazo, o `None` si el evento es válido."""
    if latitude is None or not (LAT_MIN <= latitude <= LAT_MAX):
        return "latitud fuera de rango o ausente"
    if longitude is None or not (LON_MIN <= longitude <= LON_MAX):
        return "longitud fuera de rango o ausente"
    if magnitude is None or not (MAG_MIN <= magnitude <= MAG_MAX):
        return "magnitud fuera de rango o ausente"
    if depth_km is not None and not (PROF_MIN <= depth_km <= PROF_MAX):
        return "profundidad fuera de rango"
    return None


def origin_hash(
    *,
    source_key: str,
    external_id: str,
    occurred_at: datetime,
    latitude: float,
    longitude: float,
    depth_km: float | None,
    magnitude: float | None,
) -> str:
    """Huella estable del evento para auditar la deduplicación.

    Se calcula sobre la identidad de la fuente y los atributos físicos (redondeo
    controlado) para que no dependa de detalles de serialización.
    """
    material = "|".join(
        [
            source_key,
            external_id,
            occurred_at.astimezone(timezone.utc).isoformat(),
            f"{latitude:.4f}",
            f"{longitude:.4f}",
            "" if depth_km is None else f"{depth_km:.1f}",
            "" if magnitude is None else f"{magnitude:.1f}",
        ]
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


__all__ = [
    "LAT_MIN", "LAT_MAX", "LON_MIN", "LON_MAX",
    "MAG_MIN", "MAG_MAX", "PROF_MIN", "PROF_MAX",
    "validar", "origin_hash",
]
