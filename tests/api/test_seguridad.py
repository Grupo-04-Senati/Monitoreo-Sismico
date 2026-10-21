"""Seguridad de arranque y cabeceras HTTP (PDF §12). Sin base de datos.

    pytest tests/api -q
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.seguridad import problemas_produccion, verificar_arranque
from app.main import app

SEGURA = dict(
    ENV="production",
    API_SECRET_KEY="x" * 48,
    COOKIE_SECURE=True,
    POSTGRES_PASSWORD="una-clave-larga-de-produccion",
    CORS_ORIGINS=["https://sismo.empresa.pe"],
    DB_ECHO=False,
)


def _ajustes(**cambios) -> Settings:
    return Settings(_env_file=None, **{**SEGURA, **cambios})


def test_produccion_segura_arranca():
    assert problemas_produccion(_ajustes()) == []
    verificar_arranque(_ajustes())


@pytest.mark.parametrize(
    ("cambio", "texto"),
    [
        ({"API_SECRET_KEY": "dev-secret-change-me"}, "API_SECRET_KEY"),
        ({"API_SECRET_KEY": "corta"}, "API_SECRET_KEY"),
        ({"COOKIE_SECURE": False}, "COOKIE_SECURE"),
        ({"POSTGRES_PASSWORD": "sismo_dev"}, "POSTGRES_PASSWORD"),
        ({"CORS_ORIGINS": ["*"]}, "'*'"),
        ({"CORS_ORIGINS": ["http://localhost:5173"]}, "localhost"),
        ({"DB_ECHO": True}, "DB_ECHO"),
    ],
)
def test_produccion_insegura_no_arranca(cambio, texto):
    with pytest.raises(RuntimeError, match="no arranca"):
        verificar_arranque(_ajustes(**cambio))
    assert any(texto in p for p in problemas_produccion(_ajustes(**cambio)))


def test_desarrollo_no_se_bloquea():
    assert problemas_produccion(Settings(_env_file=None, ENV="development")) == []


def test_cabeceras_de_seguridad():
    with TestClient(app) as c:
        r = c.get("/health")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert "Referrer-Policy" in r.headers and "Permissions-Policy" in r.headers
    assert "Strict-Transport-Security" not in r.headers  # solo en producción (HTTPS)
