"""Configuración común de las pruebas de la API.

Carga `services/api/.env` (si existe) antes de que se importe `app`, para que
`pytest` funcione desde la raíz del repo con la misma base que la API local.
Las variables ya definidas en el entorno (p. ej. en CI) tienen prioridad.
"""

from __future__ import annotations

import sys
from pathlib import Path

from dotenv import load_dotenv

_API = Path(__file__).resolve().parents[2] / "services" / "api"
sys.path.insert(0, str(_API))
load_dotenv(_API / ".env", override=False)


import asyncio  # noqa: E402

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _pool_por_prueba():
    """Cada `TestClient` corre en su propio bucle de eventos y las conexiones de
    asyncpg no pueden pasar de un bucle a otro: se suelta el pool (sin cerrar
    conexiones ligadas a un bucle ya terminado) antes y después de cada prueba."""
    from app.db.database import engine
    from app.services import cache_catalogo

    asyncio.run(engine.dispose(close=False))
    cache_catalogo.vaciar()  # ninguna prueba ve respuestas guardadas por otra
    yield
    asyncio.run(engine.dispose(close=False))
