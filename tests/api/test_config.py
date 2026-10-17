import pytest
from pydantic import ValidationError

from app.core.config import Settings

SECRET_OK = "k9Xv2QmT7rLp4WzB8nJd5HcY1sFg6AeU"
PROD = {
    "ENVIRONMENT": "production",
    "API_SECRET_KEY": SECRET_OK,
    "API_DEBUG": False,
    "COOKIE_SECURE": True,
    "CORS_ORIGINS": "https://app.example.org",
    "DATABASE_URL": "postgres://u:p@host/db",
}


def make(**kw):
    return Settings(_env_file=None, **kw)


def test_local_acepta_configuracion_de_desarrollo():
    s = make()
    assert not s.is_production
    assert s.database_url.startswith("postgresql+psycopg://sismo:")


@pytest.mark.parametrize("prefix", ["postgres://", "postgresql://", "postgresql+psycopg://"])
def test_url_de_proveedor_se_convierte_a_psycopg(prefix):
    s = make(DATABASE_URL=prefix + "u:p@host/db")
    assert s.database_url.startswith("postgresql+psycopg://u:p@host")


def test_clave_con_caracteres_especiales_no_rompe_la_url():
    s = make(POSTGRES_PASSWORD="p@ss/w:rd#1", POSTGRES_HOST="localhost")
    assert "p%40ss%2Fw%3Ard%231" in s.database_url


def test_cors_no_acepta_comodin():
    with pytest.raises(ValidationError):
        make(CORS_ORIGINS="*")


def test_cors_acepta_varios_origenes_separados_por_comas():
    s = make(CORS_ORIGINS="http://a.test, http://b.test")
    assert s.cors_origins_list == ["http://a.test", "http://b.test"]


def test_produccion_valida_es_aceptada():
    assert make(**PROD).is_production


@pytest.mark.parametrize(
    "cambio",
    [
        {"API_SECRET_KEY": "corta"},
        {"API_SECRET_KEY": "cambia_esta_clave_por_una_larga_de_32_caracteres"},
        {"API_SECRET_KEY": "dev-secret-change-me"},
        {"API_SECRET_KEY": "a" * 40},
        {"API_DEBUG": True},
        {"COOKIE_SECURE": False},
        {"CORS_ORIGINS": "http://sitio.org"},
        {"DATABASE_URL": None},  # sin URL, las credenciales por defecto (sismo_dev) no se admiten
    ],
)
def test_produccion_rechaza_configuracion_insegura(cambio):
    with pytest.raises(ValidationError):
        make(**{**PROD, **cambio})
