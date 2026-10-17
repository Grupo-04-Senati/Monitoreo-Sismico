import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.core.config import settings
from app.main import app


@pytest.fixture()
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def _database_reachable() -> bool:
    engine = create_engine(settings.database_url, connect_args={"connect_timeout": 3})
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
    finally:
        engine.dispose()


@pytest.fixture(scope="session")
def require_db():
    """Las pruebas con base de datos se omiten si no hay PostgreSQL alcanzable (se avisa con `-rs`, no se oculta)."""
    if not _database_reachable():
        pytest.skip("PostgreSQL no disponible: define DATABASE_URL (o POSTGRES_*) en el .env de la raiz para ejecutar estas pruebas")
