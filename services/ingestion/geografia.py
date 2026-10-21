"""Departamento del Perú de un epicentro (lógica pura, sin dependencias externas).

Regla (decisión D24):
- Si el epicentro cae dentro de un departamento, se devuelve ese departamento.
- Si cae fuera de los polígonos (casi siempre en el mar) y la fuente lo sitúa en el
  Perú (su texto de lugar menciona "Peru"), se devuelve el departamento más cercano,
  siempre que esté a menos de `DISTANCIA_MAX_KM`.
- En otro caso (otro país, sin texto de lugar o demasiado lejos), `None`: no se
  inventa una región. Así un sismo en Bolivia junto a la frontera no pasa a "Puno".

Los polígonos vienen de `datos/peru_departamental_simple.geojson` (ver su README).
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

ARCHIVO = Path(__file__).resolve().parent / "datos" / "peru_departamental_simple.geojson"

#: Distancia máxima al departamento más cercano para epicentros fuera de los polígonos
#: que la fuente sitúa en el Perú (cubre el 99,5 % del catálogo 2000–2026).
DISTANCIA_MAX_KM = 200.0

#: Nombre del archivo (NOMBDEP, en mayúsculas y sin tildes) → nombre que muestra la plataforma.
NOMBRES = {
    "AMAZONAS": "Amazonas", "ANCASH": "Áncash", "APURIMAC": "Apurímac", "AREQUIPA": "Arequipa",
    "AYACUCHO": "Ayacucho", "CAJAMARCA": "Cajamarca", "CALLAO": "Callao", "CUSCO": "Cusco",
    "HUANCAVELICA": "Huancavelica", "HUANUCO": "Huánuco", "ICA": "Ica", "JUNIN": "Junín",
    "LA LIBERTAD": "La Libertad", "LAMBAYEQUE": "Lambayeque", "LIMA": "Lima", "LORETO": "Loreto",
    "MADRE DE DIOS": "Madre de Dios", "MOQUEGUA": "Moquegua", "PASCO": "Pasco", "PIURA": "Piura",
    "PUNO": "Puno", "SAN MARTIN": "San Martín", "TACNA": "Tacna", "TUMBES": "Tumbes", "UCAYALI": "Ucayali",
}

RADIO_TIERRA_KM = 6371.0
Anillo = list[tuple[float, float]]  # (lon, lat)


@dataclass(frozen=True)
class Departamento:
    nombre: str
    poligonos: tuple[tuple[Anillo, ...], ...]  # cada polígono: anillo exterior + huecos
    caja: tuple[float, float, float, float]  # lon_min, lat_min, lon_max, lat_max


def _poligonos(geometria: dict[str, Any]) -> list[list[Anillo]]:
    if geometria["type"] == "Polygon":
        crudos = [geometria["coordinates"]]
    elif geometria["type"] == "MultiPolygon":
        crudos = geometria["coordinates"]
    else:
        return []
    return [[[(float(x), float(y)) for x, y, *_ in anillo] for anillo in poligono] for poligono in crudos]


@lru_cache(maxsize=1)
def departamentos() -> tuple[Departamento, ...]:
    datos = json.loads(ARCHIVO.read_text(encoding="utf-8"))
    salida = []
    for f in datos["features"]:
        clave = str(f["properties"]["NOMBDEP"]).strip().upper()
        polis = _poligonos(f["geometry"])
        puntos = [p for poli in polis for p in poli[0]]
        caja = (min(p[0] for p in puntos), min(p[1] for p in puntos), max(p[0] for p in puntos), max(p[1] for p in puntos))
        salida.append(Departamento(NOMBRES.get(clave, clave.title()), tuple(tuple(a for a in poli) for poli in polis), caja))
    return tuple(salida)


def _dentro_anillo(lon: float, lat: float, anillo: Anillo) -> bool:
    """Rayo hacia el este (par/impar)."""
    dentro = False
    j = len(anillo) - 1
    for i in range(len(anillo)):
        xi, yi = anillo[i]
        xj, yj = anillo[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            dentro = not dentro
        j = i
    return dentro


def _dentro(lon: float, lat: float, d: Departamento) -> bool:
    lon_min, lat_min, lon_max, lat_max = d.caja
    if not (lon_min <= lon <= lon_max and lat_min <= lat <= lat_max):
        return False
    for exterior, *huecos in d.poligonos:
        if _dentro_anillo(lon, lat, exterior) and not any(_dentro_anillo(lon, lat, h) for h in huecos):
            return True
    return False


def _km_a_segmento(lon: float, lat: float, a: tuple[float, float], b: tuple[float, float]) -> float:
    """Distancia aproximada (proyección local equirrectangular; error mínimo a < 200 km)."""
    k = math.cos(math.radians(lat))
    px, py = 0.0, 0.0
    ax, ay = (a[0] - lon) * k, a[1] - lat
    bx, by = (b[0] - lon) * k, b[1] - lat
    dx, dy = bx - ax, by - ay
    largo2 = dx * dx + dy * dy
    t = 0.0 if largo2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / largo2))
    cx, cy = ax + t * dx, ay + t * dy
    return math.radians(math.hypot(cx, cy)) * RADIO_TIERRA_KM


def distancia_km(lon: float, lat: float, d: Departamento) -> float:
    if _dentro(lon, lat, d):
        return 0.0
    mejor = math.inf
    for poligono in d.poligonos:
        exterior = poligono[0]
        for i in range(len(exterior) - 1):
            mejor = min(mejor, _km_a_segmento(lon, lat, exterior[i], exterior[i + 1]))
    return mejor


def _en_peru_segun_fuente(lugar: str | None) -> bool:
    return bool(lugar) and "peru" in lugar.lower()


def departamento(lat: float | None, lon: float | None, lugar: str | None = None) -> str | None:
    """Departamento del epicentro según la regla del módulo, o `None`.

    `lugar` es el texto de la fuente (p. ej. "43 km W of Puerto Santa, Peru").
    """
    if lat is None or lon is None:
        return None
    deps = departamentos()
    for d in deps:
        if _dentro(lon, lat, d):
            return d.nombre
    if not _en_peru_segun_fuente(lugar):
        return None
    # Fuera de los polígonos y situado en el Perú: el más cercano, dentro del límite.
    margen = DISTANCIA_MAX_KM / 100.0 + 0.5  # grados de holgura para descartar por caja
    candidatos = [
        d for d in deps
        if d.caja[0] - margen <= lon <= d.caja[2] + margen and d.caja[1] - margen <= lat <= d.caja[3] + margen
    ]
    if not candidatos:
        return None
    dist, nombre = min((distancia_km(lon, lat, d), d.nombre) for d in candidatos)
    return nombre if dist <= DISTANCIA_MAX_KM else None


def geojson_con_nombres() -> dict[str, Any]:
    """El GeoJSON original con `nombre` (como en la plataforma) en cada departamento."""
    datos = json.loads(ARCHIVO.read_text(encoding="utf-8"))
    for f in datos["features"]:
        clave = str(f["properties"]["NOMBDEP"]).strip().upper()
        f["properties"] = {**f["properties"], "nombre": NOMBRES.get(clave, clave.title())}
    return datos


__all__ = ["DISTANCIA_MAX_KM", "NOMBRES", "departamento", "departamentos", "distancia_km", "geojson_con_nombres"]
