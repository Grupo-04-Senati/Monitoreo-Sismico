"""Sector geográfico de un dataset (decisión D32).

Un dataset puede limitarse a un sector: departamentos (campo `region`, asignado con los
límites del INEI) o un radio alrededor de un activo (distancia al epicentro). La zona se
guarda en `query_spec["zona"]` y se aplica igual al crear el dataset y al contar las semanas
recientes de una estimación, para que el modelo y su estimación hablen del mismo sector.
"""

from __future__ import annotations

import math
from typing import Iterable, TypeVar

RADIO_TIERRA_KM = 6371.0088

T = TypeVar("T")


def distancia_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    d_lat, d_lon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    return 2 * RADIO_TIERRA_KM * math.asin(math.sqrt(a))


def es_toda(zona: dict | None) -> bool:
    return not zona or zona.get("tipo", "todo") == "todo"


def dentro(zona: dict | None, *, lat: float, lon: float, region: str | None) -> bool:
    """El evento cae en la zona (sin zona = toda la cobertura)."""
    if es_toda(zona):
        return True
    if zona["tipo"] == "departamentos":
        return region is not None and region in set(zona.get("departamentos") or [])
    return distancia_km(zona["lat"], zona["lon"], lat, lon) <= float(zona["radio_km"])


def filtrar(filas: Iterable[T], zona: dict | None) -> tuple[list[T], int]:
    """(filas dentro de la zona, cuántas quedaron fuera). Cada fila tiene latitude, longitude y region."""
    lista = list(filas)
    if es_toda(zona):
        return lista, 0
    dentro_ = [f for f in lista if dentro(zona, lat=f.latitude, lon=f.longitude, region=getattr(f, "region", None))]
    return dentro_, len(lista) - len(dentro_)


def describir(zona: dict | None) -> str:
    if es_toda(zona):
        return "Toda la cobertura del catálogo (Perú y alrededores)"
    if zona["tipo"] == "departamentos":
        return "Departamentos: " + ", ".join(zona.get("departamentos") or [])
    lugar = zona.get("nombre") or f"({zona['lat']:.2f}, {zona['lon']:.2f})"
    return f"{lugar}: {float(zona['radio_km']):g} km a la redonda"


__all__ = ["distancia_km", "dentro", "filtrar", "describir", "es_toda"]
