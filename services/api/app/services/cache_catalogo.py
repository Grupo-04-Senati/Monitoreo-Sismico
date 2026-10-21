"""Caché corta del catálogo compacto en el servidor (decisión D26).

`GET /events/compact` es la respuesta más pesada (hasta ~2,4 MB sin comprimir con el
catálogo completo) y muchas pantallas y usuarios piden las mismas combinaciones de
filtros. Se guarda la respuesta **ya serializada** durante `TTL_SEG` segundos.

Nunca sirve datos viejos tras una sincronización: la clave incluye la hora de la
última ejecución de ingesta terminada, así que en cuanto el worker (otro proceso)
termina una sincronización, la clave cambia y se vuelve a consultar la base.
"""

from __future__ import annotations

import json
import time
from collections import OrderedDict
from typing import Any, Awaitable, Callable

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import IngestionRun

TTL_SEG = 30
MAX_ENTRADAS = 16

_cache: OrderedDict[tuple, tuple[float, bytes]] = OrderedDict()
estadisticas = {"aciertos": 0, "fallos": 0}


async def _version_datos(db: AsyncSession) -> str:
    """Cambia cada vez que termina una sincronización (de cualquier proceso)."""
    ultima = await db.scalar(select(func.max(IngestionRun.finished_at)))
    return ultima.isoformat() if ultima else "-"


async def obtener(db: AsyncSession, filtros: dict[str, Any], calcular: Callable[[], Awaitable[dict]]) -> bytes:
    """Respuesta JSON (bytes) de la caché o recién calculada."""
    clave = (await _version_datos(db), tuple(sorted((k, v) for k, v in filtros.items() if v is not None)))
    ahora = time.monotonic()
    guardado = _cache.get(clave)
    if guardado and ahora - guardado[0] < TTL_SEG:
        _cache.move_to_end(clave)
        estadisticas["aciertos"] += 1
        return guardado[1]
    estadisticas["fallos"] += 1
    # Mismo formato que JSONResponse de Starlette (sin NaN, sin espacios).
    cuerpo = json.dumps(await calcular(), ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")
    _cache[clave] = (ahora, cuerpo)
    _cache.move_to_end(clave)
    while len(_cache) > MAX_ENTRADAS:
        _cache.popitem(last=False)
    return cuerpo


def vaciar() -> None:
    _cache.clear()
    estadisticas.update(aciertos=0, fallos=0)


__all__ = ["TTL_SEG", "MAX_ENTRADAS", "obtener", "vaciar", "estadisticas"]
