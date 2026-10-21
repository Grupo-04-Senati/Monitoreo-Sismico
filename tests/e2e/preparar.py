"""Prepara la base de las pruebas E2E desde cero (la llama Playwright antes de la API).

1. Borra y vuelve a crear la base (solo si su nombre termina en `_e2e`).
2. Aplica las migraciones.
3. Carga la muestra real del USGS (`tests/fixtures/usgs_peru_2025_m45.json`).
4. Crea tres cuentas de prueba (Administrador, Operador de alertas y Analista) con la
   contraseña de `E2E_PASSWORD`, que Playwright genera al azar en cada ejecución.

Variables: POSTGRES_* (o `services/api/.env`), POSTGRES_DB (debe terminar en `_e2e`)
y E2E_PASSWORD.
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
API = RAIZ / "services" / "api"
MUESTRA = RAIZ / "tests" / "fixtures" / "usgs_peru_2025_m45.json"

CUENTAS = [
    ("e2e-admin@empresa-ejemplo.pe", "E2E Administrador", "admin"),
    ("e2e-operador@empresa-ejemplo.pe", "E2E Operador", "alert_operator"),
    ("e2e-analista@empresa-ejemplo.pe", "E2E Analista", "analyst"),
]


def _cargar_env() -> None:
    from dotenv import load_dotenv

    load_dotenv(API / ".env", override=False)


async def _recrear_base(nombre: str) -> None:
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    url = (
        f"postgresql+asyncpg://{os.environ.get('POSTGRES_USER', 'sismo')}:{os.environ['POSTGRES_PASSWORD']}"
        f"@{os.environ.get('POSTGRES_HOST', 'localhost')}:{os.environ.get('POSTGRES_PORT', '5432')}/postgres"
    )
    motor = create_async_engine(url, isolation_level="AUTOCOMMIT")
    async with motor.connect() as conn:
        await conn.execute(text(f'DROP DATABASE IF EXISTS "{nombre}" WITH (FORCE)'))
        await conn.execute(text(f'CREATE DATABASE "{nombre}"'))
    await motor.dispose()


def _correr(*args: str, env: dict[str, str] | None = None) -> None:
    subprocess.run([sys.executable, *args], cwd=API, check=True, env=env)


def main() -> None:
    _cargar_env()
    nombre = os.environ.get("POSTGRES_DB", "")
    if not nombre.endswith("_e2e"):
        sys.exit(f"Por seguridad solo se prepara una base que termine en _e2e (recibido: '{nombre}').")
    if not os.environ.get("E2E_PASSWORD"):
        sys.exit("Falta E2E_PASSWORD (la genera playwright.config.ts).")

    asyncio.run(_recrear_base(nombre))
    _correr("-m", "alembic", "upgrade", "head")
    _correr("-m", "app.scripts.cargar_muestra", str(MUESTRA))
    env = {**os.environ, "SISMO_ADMIN_PASSWORD": os.environ["E2E_PASSWORD"]}
    for correo, nombre_cuenta, rol in CUENTAS:
        _correr("-m", "app.scripts.crear_admin", "--email", correo, "--name", nombre_cuenta, "--role", rol, "--force", env=env)
    print(f"Base {nombre} lista para E2E.")


if __name__ == "__main__":
    main()
