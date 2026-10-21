"""Revisiones de eventos que la fuente corrige (decisión D27).

El USGS corrige eventos días después (magnitud, ubicación, profundidad, o pasa de
"automático" a "revisado"). Cuando llega una versión con fecha de modificación más
nueva y valores distintos:

1. Se guarda la versión anterior y la nueva en `seismic_event_revisions` (solo inserción).
2. Se actualiza el evento (y su `raw_payload`, `revised_at`, `revision_count`).

Los datasets aprobados y sus modelos no deben cambiar: `valores_a_la_fecha` devuelve,
para cada evento revisado después de una fecha, los valores que tenía en esa fecha.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now
from app.db.models import SeismicEvent, SeismicEventRevision

#: Campos que una revisión puede cambiar (y que se comparan).
CAMPOS = (
    "occurred_at", "latitude", "longitude", "depth_km", "magnitude", "magnitude_type",
    "review_status", "region", "locality", "source_url",
)
_REDONDEO = {"latitude": 4, "longitude": 4, "depth_km": 2, "magnitude": 2}


def _json(campo: str, valor: Any) -> Any:
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.isoformat()
    if campo in _REDONDEO:
        return round(float(valor), _REDONDEO[campo])
    return valor


def foto(objeto: Any) -> dict[str, Any]:
    """Valores comparables de un evento (guardado o recién normalizado)."""
    return {c: _json(c, getattr(objeto, c, None)) for c in CAMPOS}


def _desde_json(campo: str, valor: Any) -> Any:
    if campo == "occurred_at" and isinstance(valor, str):
        return datetime.fromisoformat(valor)
    return valor


async def aplicar(db: AsyncSession, actual: SeismicEvent, nuevo: Any) -> bool:
    """Aplica `nuevo` (NormalizedEvent) sobre `actual` si es una corrección real.

    Devuelve True si hubo revisión. Una versión sin fecha más nueva se ignora; una con
    fecha más nueva pero sin cambios solo actualiza `source_updated_at`.
    """
    fecha = getattr(nuevo, "source_updated_at", None)
    if fecha is None or (actual.source_updated_at is not None and fecha <= actual.source_updated_at):
        return False
    antes, despues = foto(actual), foto(nuevo)
    actual.source_updated_at = fecha
    if antes == despues:
        return False
    # Hora real de aplicación (no `now()` de la base, que es el inicio de la transacción).
    momento = clock_now()
    db.add(SeismicEventRevision(
        event_id=actual.id, revised_at=momento, source_updated_at=fecha, before_json=antes, after_json=despues,
    ))
    for campo in CAMPOS:
        setattr(actual, campo, getattr(nuevo, campo))
    actual.origin_hash = nuevo.origin_hash
    actual.raw_payload = nuevo.raw
    actual.revised_at = momento
    actual.revision_count = (actual.revision_count or 0) + 1
    return True


async def valores_a_la_fecha(db: AsyncSession, ids: list[str], fecha: datetime) -> dict[str, dict[str, Any]]:
    """Para los eventos revisados después de `fecha`, los valores que tenían en esa fecha.

    Es la versión "antes" de la primera revisión posterior a `fecha`. Los eventos sin
    revisiones posteriores no aparecen (sus valores actuales ya son los de esa fecha).
    """
    if not ids:
        return {}
    filas = (
        await db.execute(
            select(SeismicEventRevision.event_id, SeismicEventRevision.before_json)
            .where(SeismicEventRevision.event_id.in_(ids), SeismicEventRevision.revised_at > fecha)
            .order_by(SeismicEventRevision.event_id, SeismicEventRevision.revised_at)
        )
    ).all()
    salida: dict[str, dict[str, Any]] = {}
    for event_id, antes in filas:
        if event_id not in salida:
            salida[event_id] = {c: _desde_json(c, v) for c, v in antes.items()}
    return salida


def valor(evento: SeismicEvent, campo: str, anteriores: dict[str, dict[str, Any]]) -> Any:
    """Valor del campo a la fecha pedida: el anterior si el evento se revisó después."""
    previo = anteriores.get(evento.id)
    return previo[campo] if previo is not None and campo in previo else getattr(evento, campo)


__all__ = ["CAMPOS", "aplicar", "foto", "valor", "valores_a_la_fecha"]
