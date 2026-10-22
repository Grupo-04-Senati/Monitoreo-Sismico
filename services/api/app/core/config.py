from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    #: Entorno de ejecución: "development" | "test" | "production".
    ENV: str = "development"

    POSTGRES_USER: str = "sismo"
    POSTGRES_PASSWORD: str = "sismo_dev"
    POSTGRES_DB: str = "sismo_db"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    #: Imprime cada consulta SQL con sus valores (incluye hashes y secretos).
    #: Independiente de API_DEBUG; activar solo para depurar SQL en local.
    DB_ECHO: bool = False

    API_SECRET_KEY: str = "dev-secret-change-me"
    API_DEBUG: bool = True
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    #: Cookies de sesión. `Secure` debe activarse en producción (HTTPS).
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    REDIS_URL: str = "redis://redis:6379/0"
    #: Dónde se cuentan los intentos de acceso: "auto" (Redis si responde, si no memoria),
    #: "redis" o "memoria". Con varios procesos de API debe ser Redis (D25).
    LOGIN_THROTTLE_BACKEND: str = "auto"

    #: Simulador de sismos ficticios para demostraciones (D29). Nunca en una instalación real.
    DEMO_SIMULACION: bool = False
    #: Carpeta con la web compilada para servirla desde la API (despliegue de un solo
    #: servicio, p. ej. Render). Vacío = la web la sirve Caddy o Vite.
    WEB_DIST_DIR: str = ""
    #: Exigir SSL al conectar con PostgreSQL (bases administradas externas, p. ej. Render).
    POSTGRES_SSL: bool = False

    #: Clave de la fuente única del MVP (mientras no exista la fuente real).
    INGESTION_SOURCE_KEY: str = "igp"
    #: Frecuencia de la ingesta programada (minutos).
    INGESTION_INTERVAL_MINUTES: int = 15

    #: Carpeta de copias de seguridad que vigila el monitoreo (vacío = no se vigila).
    MONITOREO_BACKUP_DIR: str = ""

    #: Carpeta de artefactos de ML (modelos entrenados). Vacío = `services/ml/artifacts`.
    ML_ARTIFACTS_DIR: str = ""

    #: Correo de avisos internos. Desactivado: la entrega queda como "simulada" (no se envía).
    ALERT_EMAIL_ENABLED: bool = False
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_TLS: bool = True

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()
