"""Sismos del mundo en vivo para la vista mundial del mapa (decisión D30).

El catálogo de trabajo (reglas, datasets, modelos, indicadores) es solo la zona del Perú.
La vista mundial es **contexto**: se consulta al USGS su resumen público de sismos M4.5+
de las últimas 24 h, 7 o 30 días, se guarda unos minutos en memoria y **no se escribe en
la base** ni genera avisos.

Si el USGS no responde se entrega la última copia (marcada `desactualizado`); si nunca
hubo una, la API responde 503 con el motivo.
"""

from __future__ import annotations

import asyncio
import ssl
import time
from datetime import datetime, timezone
from typing import Any, Literal

import httpx
from fastapi import HTTPException, status

from app.core.paths import ensure_ingestion_on_path

ensure_ingestion_on_path()
from ingestion.validation import LAT_MAX, LAT_MIN, LON_MAX, LON_MIN  # noqa: E402

Periodo = Literal["dia", "semana", "mes"]

#: Resúmenes públicos del USGS (GeoJSON, sin clave). M4.5+ cubre lo que se ve a escala mundial.
URL_FEED = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_{periodo}.geojson"
_ARCHIVO = {"dia": "day", "semana": "week", "mes": "month"}
#: Minutos que se reutiliza una respuesta (el USGS actualiza estos resúmenes cada minuto).
TTL_SEGUNDOS = 300
TIMEOUT_SEGUNDOS = 15

_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_candado = asyncio.Lock()


def en_zona_peru(lat: float, lon: float) -> bool:
    """El sismo cae en la zona que vigila el catálogo de trabajo (la misma de la ingesta)."""
    return LAT_MIN <= lat <= LAT_MAX and LON_MIN <= lon <= LON_MAX


def _iso(ms: int | None) -> str | None:
    if ms is None:
        return None
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def adaptar(feed: dict[str, Any], periodo: Periodo) -> dict[str, Any]:
    """Del GeoJSON del USGS a una lista compacta (solo lo que dibuja y muestra el mapa)."""
    items = []
    for f in feed.get("features", []):
        p = f.get("properties") or {}
        coords = (f.get("geometry") or {}).get("coordinates") or []
        if len(coords) < 2 or p.get("mag") is None:
            continue
        lon, lat = float(coords[0]), float(coords[1])
        items.append({
            "id": f.get("id"),
            "magnitud": round(float(p["mag"]), 1),
            "tipo_magnitud": p.get("magType"),
            "lugar": p.get("place"),
            "fecha": _iso(p.get("time")),
            "lat": round(lat, 3),
            "lon": round(lon, 3),
            "profundidad_km": round(float(coords[2]), 1) if len(coords) > 2 and coords[2] is not None else None,
            "estado": p.get("status"),
            "url": p.get("url"),
            "zona_peru": en_zona_peru(lat, lon),
        })
    items.sort(key=lambda e: e["fecha"] or "", reverse=True)
    meta = feed.get("metadata") or {}
    return {
        "periodo": periodo,
        "fuente": "USGS — resumen público de sismos M4.5+ (en vivo)",
        "generado_fuente": _iso(meta.get("generated")),
        "total": len(items),
        "items": items,
    }


async def _descargar(periodo: Periodo) -> dict[str, Any]:
    # Certificados del sistema operativo, como el conector de ingesta (urllib): en equipos
    # con inspección TLS (antivirus, proxy corporativo) la lista propia de httpx no basta.
    async with httpx.AsyncClient(timeout=TIMEOUT_SEGUNDOS, verify=ssl.create_default_context()) as cliente:
        r = await cliente.get(URL_FEED.format(periodo=_ARCHIVO[periodo]))
        r.raise_for_status()
        return r.json()


async def sismos_mundo(periodo: Periodo) -> dict[str, Any]:
    """Sismos M4.5+ del mundo del periodo; reutiliza la copia de los últimos minutos."""
    ahora = time.monotonic()
    guardado = _cache.get(periodo)
    if guardado and ahora - guardado[0] < TTL_SEGUNDOS:
        return {**guardado[1], "desactualizado": False}
    async with _candado:
        guardado = _cache.get(periodo)
        if guardado and time.monotonic() - guardado[0] < TTL_SEGUNDOS:
            return {**guardado[1], "desactualizado": False}
        try:
            datos = adaptar(await _descargar(periodo), periodo)
        except (httpx.HTTPError, ValueError) as exc:
            if guardado:  # mejor una copia vieja (marcada) que nada
                return {**guardado[1], "desactualizado": True}
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="El USGS no respondió; la vista mundial no está disponible por ahora.",
            ) from exc
        _cache[periodo] = (time.monotonic(), datos)
        return {**datos, "desactualizado": False}


def limpiar_cache() -> None:
    _cache.clear()


__all__ = ["Periodo", "sismos_mundo", "adaptar", "en_zona_peru", "limpiar_cache"]
