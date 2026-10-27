"""Router del módulo "Mapa sísmico" (6.3).

La lectura geoespacial de eventos vive en el router de eventos
(`GET /api/v1/events/geojson`) porque comparte sus filtros y su catálogo.
Aquí se sirven las capas base: los límites departamentales (D24), con `nombre`
igual al de la plataforma para cruzarlos con el campo `region` de los eventos, y la
vista mundial (D30): contornos de países y sismos M4.5+ del mundo en vivo (no se guardan).
"""

import json
from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.core.paths import ensure_ingestion_on_path, ingestion_dir
from app.core.permissions import require_permission
from app.services.mundo import sismos_mundo

ensure_ingestion_on_path()
from ingestion.geografia import geojson_con_nombres  # noqa: E402

router = APIRouter(dependencies=[Depends(require_permission("mapa"))])


@lru_cache(maxsize=1)
def _capa_departamentos() -> dict:
    return geojson_con_nombres()


@router.get("/regions/geojson")
async def regiones_geojson() -> JSONResponse:
    """Límites de los 25 departamentos (GeoJSON). No cambia: el navegador puede guardarlo un día."""
    return JSONResponse(_capa_departamentos(), headers={"Cache-Control": "private, max-age=86400"})


@lru_cache(maxsize=1)
def _capa_mundo() -> dict:
    carpeta = ingestion_dir()
    if carpeta is None:
        return {"type": "FeatureCollection", "features": []}
    return json.loads((carpeta / "datos" / "mundo_paises_110m.geojson").read_text(encoding="utf-8"))


@router.get("/regions/mundo")
async def mundo_geojson() -> JSONResponse:
    """Contornos de los países (Natural Earth, dominio público). Fondo de la vista mundial."""
    return JSONResponse(_capa_mundo(), headers={"Cache-Control": "private, max-age=86400"})


@router.get("/world/events")
async def sismos_del_mundo(periodo: Literal["dia", "semana", "mes"] = Query(default="semana")) -> JSONResponse:
    """Sismos M4.5+ del mundo de las últimas 24 h, 7 o 30 días, en vivo desde el USGS."""
    datos = await sismos_mundo(periodo)
    return JSONResponse(datos, headers={"Cache-Control": "private, max-age=60"})


__all__ = ["router"]
