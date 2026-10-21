"""Hace pasar los sismos de la muestra por el motor de avisos (pruebas E2E).

En producción el motor corre tras cada sincronización con sismos recién llegados.
La muestra es de 2025, así que aquí se evalúa cada sismo con un "ahora" justo
después de ocurrido (como si acabara de llegar). Solo actúan las reglas activas.

Uso: python generar_avisos.py   (con POSTGRES_* apuntando a la base `_e2e`)
"""

from __future__ import annotations

import asyncio
import os
import sys
from datetime import timedelta
from pathlib import Path

API = Path(__file__).resolve().parents[2] / "services" / "api"
sys.path.insert(0, str(API))


async def main() -> int:
    from dotenv import load_dotenv

    load_dotenv(API / ".env", override=False)
    if not os.environ.get("POSTGRES_DB", "").endswith("_e2e"):
        sys.exit("Solo se ejecuta sobre una base que termine en _e2e.")

    from sqlalchemy import select

    import app.services.alertas_motor as motor
    from app.db.database import AsyncSessionLocal
    from app.db.models import SeismicEvent

    total = 0
    async with AsyncSessionLocal() as db:
        eventos = list((await db.execute(select(SeismicEvent).order_by(SeismicEvent.occurred_at))).scalars())
        for e in eventos:
            total += await motor.evaluar_eventos(db, [e], ahora=e.occurred_at + timedelta(hours=1))
    print(f"Avisos generados: {total}")
    return total


if __name__ == "__main__":
    asyncio.run(main())
