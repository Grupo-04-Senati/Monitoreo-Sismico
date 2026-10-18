"""Router del módulo "Mapa sísmico" (6.3).

La lectura geoespacial de eventos vive en el router de eventos
(`GET /api/v1/events/geojson`) porque comparte sus filtros y su catálogo.
Este router queda reservado para una fase posterior (polígonos dibujados por el
usuario, capas base oficiales), por lo que hoy no expone rutas.
"""

from fastapi import APIRouter

router = APIRouter()

__all__ = ["router"]
