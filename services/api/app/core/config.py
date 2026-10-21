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

    #: Clave de la fuente única del MVP (mientras no exista la fuente real).
    INGESTION_SOURCE_KEY: str = "igp"
    #: Frecuencia de la ingesta programada (minutos).
    INGESTION_INTERVAL_MINUTES: int = 15

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()
