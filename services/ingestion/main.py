"""Entrada de línea de comandos del servicio de ingesta.

Ejecuta una sincronización "en seco" (sin base de datos) para comprobar que el
motor y la validación funcionan:

    python services/ingestion/main.py

Consulta el USGS de verdad (últimas 3 horas, más el solape del conector) pero
no guarda nada. La ingesta real (persistencia, ejecuciones y registro) la
orquesta `services/api/app/services/ingestion_runner.py`, que reutiliza este
paquete.
"""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingestion.engine import run_sync  # noqa: E402
from ingestion.fuentes import crear_pipeline  # noqa: E402


class _RepoNulo:
    """Repositorio vacío: no persiste, solo evita duplicados en memoria."""

    def __init__(self) -> None:
        self.ids: set[str] = set()

    async def upsert(self, event) -> bool:  # noqa: ANN001
        if event.external_id in self.ids:
            return False
        self.ids.add(event.external_id)
        return True


async def _demo() -> None:
    sina = datetime.now(timezone.utc) - timedelta(hours=3)
    connector, normalizer = crear_pipeline("usgs")
    report = await run_sync(
        connector=connector,
        normalizer=normalizer,
        repository=_RepoNulo(),
        since=sina,
    )
    print(
        f"estado={report.estado} leidos={report.leidos} "
        f"insertados={report.insertados} duplicados={report.duplicados} "
        f"rechazados={report.rechazados} error={report.error}"
    )


if __name__ == "__main__":
    asyncio.run(_demo())
