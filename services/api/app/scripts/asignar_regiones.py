"""Asigna el departamento (`region`) a los sismos ya guardados (decisión D24).

Los sismos nuevos ya llegan con su región desde el normalizador; este script completa
los que se guardaron antes. Es idempotente: sin `--todas`, solo toca los que no tienen
región; con `--todas`, recalcula todos (p. ej. si cambia la geometría o la regla).

Uso (desde ``services/api``)::

    python -m app.scripts.asignar_regiones
    python -m app.scripts.asignar_regiones --todas
"""

from __future__ import annotations

import argparse
import asyncio
from collections import Counter

from sqlalchemy import select, update

from app.core.paths import ensure_ingestion_on_path
from app.db.database import AsyncSessionLocal
from app.db.models import SeismicEvent

ensure_ingestion_on_path()
from ingestion.geografia import departamento  # noqa: E402

LOTE = 500


async def asignar(todas: bool) -> Counter:
    resumen: Counter = Counter()
    async with AsyncSessionLocal() as db:
        consulta = select(SeismicEvent.id, SeismicEvent.latitude, SeismicEvent.longitude, SeismicEvent.locality, SeismicEvent.region)
        if not todas:
            consulta = consulta.where(SeismicEvent.region.is_(None))
        filas = (await db.execute(consulta)).all()
        for inicio in range(0, len(filas), LOTE):
            for f in filas[inicio : inicio + LOTE]:
                nueva = departamento(f.latitude, f.longitude, f.locality)
                resumen[nueva or "(sin región)"] += 1
                if nueva != f.region:
                    await db.execute(update(SeismicEvent).where(SeismicEvent.id == f.id).values(region=nueva))
            await db.commit()
    return resumen


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--todas", action="store_true", help="Recalcular también los que ya tienen región.")
    args = parser.parse_args()
    resumen = asyncio.run(asignar(args.todas))
    total = sum(resumen.values())
    print(f"Sismos revisados: {total}")
    for nombre, n in resumen.most_common():
        print(f"  {nombre:20} {n:6d}")


if __name__ == "__main__":
    main()
