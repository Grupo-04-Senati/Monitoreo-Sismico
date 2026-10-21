"""Sincroniza las fuentes de datos desde la consola, sin Celery ni Redis.

Sirve en desarrollo local y como plan B de la decisión D5: si el entorno no tiene
un worker de Celery siempre encendido, un cron externo puede ejecutar este
comando cada `frequency_min` minutos. Usa el mismo motor que la API (mismas
ejecuciones, registros e idempotencia).

Uso (desde ``services/api``, con el entorno virtual activo)::

    python -m app.scripts.sincronizar              # todas las fuentes habilitadas
    python -m app.scripts.sincronizar --fuente usgs
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.db.models import DataSource, IngestionRun
from app.services.audit import esperar_auditoria, registrar_auditoria
from app.services.ingestion_runner import ejecutar_sincronizacion


async def _sincronizar(clave: str | None) -> int:
    async with AsyncSessionLocal() as db:
        consulta = select(DataSource).where(DataSource.enabled.is_(True))
        if clave:
            consulta = select(DataSource).where(DataSource.key == clave)
        fuentes = list((await db.execute(consulta)).scalars().all())
    if not fuentes:
        print(f"No hay fuentes {'con clave ' + repr(clave) if clave else 'habilitadas'}.")
        return 1

    codigo = 0
    for fuente in fuentes:
        run_id = await ejecutar_sincronizacion(fuente.id, triggered_by="cli")
        async with AsyncSessionLocal() as db:
            run = await db.get(IngestionRun, run_id)
        registrar_auditoria(
            actor_id=None,
            action="fuente_sincronizar",
            entity_type="data_source",
            entity_id=fuente.id,
            after={"run_id": run_id, "triggered_by": "cli"},
        )
        if run is None:
            print(f"[{fuente.key}] sin ejecución registrada")
            codigo = 1
            continue
        print(
            f"[{fuente.key}] {run.status}: {run.records_read} leídos, "
            f"{run.records_inserted} insertados, {run.duplicates_skipped} duplicados"
            + (f" — {run.error_summary}" if run.error_summary else "")
        )
        if run.status == "fallida":
            codigo = 1
    await esperar_auditoria()
    return codigo


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.scripts.sincronizar",
        description="Sincroniza las fuentes de datos sísmicos.",
    )
    parser.add_argument("--fuente", help="Clave de la fuente (por defecto: todas las habilitadas).")
    args = parser.parse_args(argv)
    return asyncio.run(_sincronizar(args.fuente))


if __name__ == "__main__":
    sys.exit(main())
