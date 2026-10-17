"""Las migraciones se aplican desde cero sobre una base de pruebas propia (`<nombre>_test`); la de desarrollo no se toca."""
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

from app.core.config import settings

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "database" / "migrations"


def _cfg(url: str | None = None) -> Config:
    cfg = Config(str(ROOT / "services" / "api" / "alembic.ini"))
    cfg.set_main_option("script_location", str(MIGRATIONS))
    if url:
        cfg.attributes["database_url"] = url
    return cfg


def test_una_sola_cabeza_de_alembic():
    """Con varias personas creando migraciones, dos ramas pueden dejar dos cabezas: se detecta antes del merge."""
    heads = ScriptDirectory.from_config(_cfg()).get_heads()
    assert len(heads) == 1, f"Hay {len(heads)} cabezas de Alembic ({heads}): rebasa tu rama y renumera tu migracion"


@pytest.fixture()
def test_url(require_db):
    url = make_url(settings.database_url)
    test_db = f"{url.database}_test"
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{test_db}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{test_db}"'))
    yield url.set(database=test_db).render_as_string(hide_password=False)
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{test_db}" WITH (FORCE)'))
    admin.dispose()


def test_migraciones_suben_y_bajan_sin_diferencias_con_los_modelos(test_url):
    cfg = _cfg(test_url)
    command.upgrade(cfg, "head")
    command.check(cfg)  # falla si los modelos y las migraciones no coinciden

    engine = create_engine(test_url)
    try:
        assert "system_settings" in inspect(engine).get_table_names()
        with engine.connect() as conn:
            tz = conn.execute(text("SELECT value FROM system_settings WHERE key = 'display_timezone'")).scalar_one()
        assert tz == "America/Lima"
    finally:
        engine.dispose()

    command.downgrade(cfg, "base")
    engine = create_engine(test_url)
    try:
        assert "system_settings" not in inspect(engine).get_table_names()
    finally:
        engine.dispose()
