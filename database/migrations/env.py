import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import create_engine

# Permite importar `app` al ejecutar alembic desde services/api
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "api"))

from app.core.config import settings  # noqa: E402
from app.db.database import Base  # noqa: E402
import app.db.models  # noqa: E402,F401  (registra los modelos en Base.metadata)

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(url=settings.database_url, target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Una URL explicita permite a las pruebas migrar una base distinta de la de desarrollo
    url = config.attributes.get("database_url") or settings.database_url
    engine = create_engine(url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
