"""Router del módulo "Mapa sísmico" (6.3).

La lectura geoespacial de eventos vive en el router de eventos
(`GET /api/v1/events/geojson`) porque comparte sus filtros y su catálogo.
Aquí se sirven las capas base: los límites departamentales (D24), con `nombre`
igual al de la plataforma para cruzarlos con el campo `region` de los eventos.
"""

from functools import lru_cache

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.core.paths import ensure_ingestion_on_path
from app.core.permissions import require_permission

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


__all__ = ["router"]
