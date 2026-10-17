from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    POSTGRES_USER: str = "sismo"
    POSTGRES_PASSWORD: str = "sismo_dev"
    POSTGRES_DB: str = "sismo_db"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

    API_SECRET_KEY: str = "dev-secret-change-me"
    API_DEBUG: bool = True
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    REDIS_URL: str = "redis://redis:6379/0"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()
