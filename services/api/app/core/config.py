from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL, make_url

# .env vive en la raiz del repositorio (cuatro niveles sobre este archivo)
ENV_FILE = Path(__file__).resolve().parents[4] / ".env"

MIN_SECRET_LENGTH = 32
PRODUCTION_NAMES = {"production", "produccion", "prod"}
# Fragmentos tipicos de claves copiadas de un ejemplo o de documentacion
WEAK_SECRET_WORDS = ("genera_una_clave", "cambia", "change", "changeme", "secret", "password", "example", "ejemplo", "default", "test")
WEAK_DB_PASSWORDS = {"sismo_dev", "cambiar_en_produccion", "postgres", "password", "123456"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    POSTGRES_USER: str = "sismo"
    POSTGRES_PASSWORD: str = "sismo_dev"
    POSTGRES_DB: str = "sismo_db"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    # URL completa (Render, Supabase...). Si existe, tiene prioridad sobre POSTGRES_*.
    DATABASE_URL: str | None = None
    # Los planes gratuitos admiten pocas conexiones: 5 + 5 de desborde = 10 como maximo por proceso.
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 5

    ENVIRONMENT: str = "local"
    API_SECRET_KEY: str = "dev-secret-change-me"
    API_DEBUG: bool = True
    # Origenes separados por comas. Con credenciales (cookie) no se admite "*".
    CORS_ORIGINS: str = "http://localhost:5173"
    COOKIE_SECURE: bool = False
    # Los datos se guardan en UTC; esta zona solo se usa para mostrarlos.
    DISPLAY_TIMEZONE: str = "America/Lima"

    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    REDIS_URL: str = "redis://redis:6379/0"

    @property
    def database_url(self) -> str:
        """Acceso sincrono (decision D12): psycopg 3. Los proveedores entregan `postgres://` o `postgresql://`."""
        if self.DATABASE_URL:
            url = make_url(self.DATABASE_URL.strip())
            return url.set(drivername="postgresql+psycopg").render_as_string(hide_password=False)
        url = URL.create(
            "postgresql+psycopg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_HOST,
            port=self.POSTGRES_PORT,
            database=self.POSTGRES_DB,
        )
        return url.render_as_string(hide_password=False)

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() in PRODUCTION_NAMES

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @model_validator(mode="after")
    def _cors_without_wildcard(self) -> "Settings":
        if "*" in self.cors_origins_list:
            raise ValueError("CORS_ORIGINS no puede ser «*»: la sesion viajara en una cookie, lista los origenes uno a uno")
        return self

    @model_validator(mode="after")
    def _production_requires_safe_config(self) -> "Settings":
        """En produccion el sistema se niega a arrancar con una configuracion insegura."""
        if not self.is_production:
            return self
        problems: list[str] = []
        key = self.API_SECRET_KEY.strip()
        if len(key) < MIN_SECRET_LENGTH:
            problems.append(f"API_SECRET_KEY debe tener al menos {MIN_SECRET_LENGTH} caracteres")
        if any(word in key.lower() for word in WEAK_SECRET_WORDS):
            problems.append("API_SECRET_KEY parece un valor de ejemplo: genera uno con `openssl rand -hex 32`")
        if len(set(key)) < 10:
            problems.append("API_SECRET_KEY es demasiado repetitiva")
        if self.API_DEBUG:
            problems.append("API_DEBUG debe ser false")
        if not self.COOKIE_SECURE:
            problems.append("COOKIE_SECURE debe ser true (la cookie de sesion solo debe viajar por HTTPS)")
        if any(o.startswith("http://") for o in self.cors_origins_list):
            problems.append("CORS_ORIGINS debe usar solo origenes https")
        if not self.DATABASE_URL and self.POSTGRES_PASSWORD.lower() in WEAK_DB_PASSWORDS:
            problems.append("POSTGRES_PASSWORD es una clave de ejemplo: define DATABASE_URL o una clave real")
        if problems:
            raise ValueError("Configuracion insegura para produccion: " + "; ".join(problems))
        return self


settings = Settings()
