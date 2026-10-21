"""Carga una muestra **real** del USGS guardada en un archivo GeoJSON (sin red).

Sirve para las pruebas E2E y el CI: usa el mismo motor que la sincronización real
(normalizador del USGS, idempotencia por evento y registro de la ejecución), solo
que el conector lee el archivo en lugar de consultar el servicio. Repetirla no
duplica eventos. No inventa datos: el archivo es una respuesta del USGS sin tocar
(ver `tests/fixtures/README.md`).

Uso (desde ``services/api``)::

    python -m app.scripts.cargar_muestra ../../tests/fixtures/usgs_peru_2025_m45.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

from app.db.database import AsyncSessionLocal
from app.services.ingestion_bridge import crear_pipeline, run_sync  # agrega `ingestion` al path
from app.services.ingestion_runner import (
    RepositorioEventos,
    finalizar_ejecucion,
    iniciar_ejecucion,
    obtener_fuente,
)

from ingestion.connectors.base import RawRecord  # noqa: E402


class ConectorArchivo:
    """Conector que entrega las `features` de un GeoJSON del USGS ya descargado."""

    nombre = "usgs"

    def __init__(self, ruta: Path) -> None:
        self.ruta = ruta

    def fetch(self, since: datetime | None) -> list[RawRecord]:
        datos = json.loads(self.ruta.read_text(encoding="utf-8"))
        return [RawRecord(external_id=str(f["id"]), payload=f) for f in datos["features"]]


async def cargar(ruta: Path) -> tuple[int, int]:
    async with AsyncSessionLocal() as db:
        fuente = await obtener_fuente(db, "usgs")
        if fuente is None:
            raise SystemExit("No existe la fuente 'usgs': aplique las migraciones (alembic upgrade head).")
        run = await iniciar_ejecucion(db, fuente, triggered_by="muestra", actor_id=None, correlation_id=None)
        _, normalizador = crear_pipeline("usgs")
        reporte = await run_sync(
            connector=ConectorArchivo(ruta),
            normalizer=normalizador,
            repository=RepositorioEventos(db, fuente.id),
            since=None,
        )
        await finalizar_ejecucion(db, run, reporte)
        return reporte.insertados, reporte.duplicados


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("archivo", type=Path, help="GeoJSON del USGS (FeatureCollection).")
    args = parser.parse_args()
    if not args.archivo.is_file():
        sys.exit(f"No existe {args.archivo}")
    insertados, duplicados = asyncio.run(cargar(args.archivo))
    print(f"Muestra cargada: {insertados} eventos nuevos, {duplicados} ya existían.")


if __name__ == "__main__":
    main()
