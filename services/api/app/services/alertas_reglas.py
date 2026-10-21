"""Evaluación de reglas de aviso sobre un evento (funciones puras, sin base de datos).

Una regla coincide con un evento si cumple **todas** sus condiciones: magnitud
mínima, rango de profundidad, solo revisados, tipos de magnitud y zona (toda la
cobertura o un círculo con centro y radio). Las plantillas usan marcadores como
`{magnitud}` o `{lugar}`; uno desconocido se deja tal cual (nunca se inventa).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from app.services.calidad_datos import distancia_km

UTC5 = timezone(timedelta(hours=-5))


@dataclass(frozen=True)
class EventoAlerta:
    id: str
    occurred_at: datetime
    latitude: float
    longitude: float
    depth_km: float | None
    magnitude: float | None
    magnitude_type: str | None
    review_status: str
    locality: str | None = None
    source_url: str | None = None


def evaluar(condicion: dict[str, Any], zona: dict[str, Any], e: EventoAlerta) -> tuple[bool, float | None]:
    """(coincide, distancia en km al centro de la zona o `None` si la zona es toda la cobertura)."""
    if e.magnitude is None or e.magnitude < float(condicion.get("magnitud_minima", 0)):
        return False, None
    pmin, pmax = condicion.get("profundidad_min_km"), condicion.get("profundidad_max_km")
    if (pmin is not None or pmax is not None) and e.depth_km is None:
        return False, None  # sin profundidad no se puede afirmar que cumple el rango
    if pmin is not None and e.depth_km < float(pmin):
        return False, None
    if pmax is not None and e.depth_km > float(pmax):
        return False, None
    if condicion.get("solo_revisados") and e.review_status != "observado":
        return False, None
    tipos = condicion.get("tipos_magnitud")
    if tipos and e.magnitude_type not in tipos:
        return False, None

    if zona.get("tipo") == "circulo":
        d = distancia_km(float(zona["lat"]), float(zona["lon"]), e.latitude, e.longitude)
        return (d <= float(zona["radio_km"]), round(d, 1))
    return True, None


def es_reciente(e: EventoAlerta, ahora: datetime, horas: int) -> bool:
    """Solo se avisa de eventos recientes: una carga histórica no debe disparar avisos."""
    return ahora - e.occurred_at <= timedelta(hours=horas)


class _Marcadores(dict):
    def __missing__(self, clave: str) -> str:
        return "{" + clave + "}"


def marcadores(e: EventoAlerta, distancia: float | None, zona: dict[str, Any], regla: str) -> dict[str, str]:
    return _Marcadores(
        magnitud=f"{e.magnitude:.1f}" if e.magnitude is not None else "—",
        tipo=e.magnitude_type or "sin tipo",
        lugar=e.locality or "—",
        fecha=e.occurred_at.astimezone(UTC5).strftime("%d/%m/%Y %H:%M") + " (UTC-5)",
        profundidad=f"{e.depth_km:.0f} km" if e.depth_km is not None else "—",
        distancia=f"{distancia:.0f} km" if distancia is not None else "—",
        zona=zona.get("nombre") or ("toda la cobertura" if zona.get("tipo") != "circulo" else "zona definida"),
        regla=regla,
        enlace=e.source_url or "—",
    )


def render(plantilla: str, valores: dict[str, str]) -> str:
    """Rellena la plantilla; un formato inválido devuelve la plantilla sin cambios."""
    try:
        return plantilla.format_map(valores)
    except (ValueError, IndexError):
        return plantilla


__all__ = ["EventoAlerta", "evaluar", "es_reciente", "marcadores", "render"]
