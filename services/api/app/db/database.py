from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import settings

# Bases administradas externas (p. ej. Render) exigen SSL: POSTGRES_SSL=true.
engine = create_async_engine(
    settings.database_url,
    echo=settings.DB_ECHO,
    connect_args={"ssl": "require"} if settings.POSTGRES_SSL else {},
)

AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
