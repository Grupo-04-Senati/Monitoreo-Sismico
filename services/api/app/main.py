from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.correlacion import correlation_id_actual
from app.core.seguridad import CABECERAS, HSTS, es_produccion, verificar_arranque
from app.db.database import get_db
from app.db.models import IngestionRun, SeismicEvent
from app.routers import (
    auth,
    eventos,
    dashboard,
    mapa,
    analisis,
    datasets,
    ml,
    estimaciones,
    alert_rules,
    alerts,
    fuentes,
    reportes,
    usuarios,
    auditoria,
    configuracion,
)
from app.services.audit import esperar_auditoria


@asynccontextmanager
async def lifespan(_: FastAPI):
    # En producción no se arranca con secretos o ajustes de desarrollo (PDF §12).
    verificar_arranque(settings)
    yield
    # No perder eventos de auditoría que aún se están escribiendo al apagar.
    await esperar_auditoria()


app = FastAPI(
    lifespan=lifespan,
    title="Sistema de Monitoreo Sísmico API",
    version="0.1.0",
    description="API para monitoreo de eventos sísmicos, análisis y alertas",
)

# Comprime las respuestas grandes (el catálogo de eventos: ~580 KB → ~110 KB por
# página de 1000). Además de acelerar la carga, evita los cortes ECONNRESET que el
# proxy de desarrollo de Vite produce en Windows con cuerpos grandes.
# Nivel 6 (el estándar de zlib): casi la misma compresión que 9 en la mitad de tiempo.
app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=6)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    """Propaga un identificador de correlación para trazar cada petición."""
    correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
    request.state.correlation_id = correlation_id
    token = correlation_id_actual.set(correlation_id)
    try:
        response = await call_next(request)
    finally:
        correlation_id_actual.reset(token)
    response.headers["X-Correlation-ID"] = correlation_id
    for nombre, valor in CABECERAS.items():
        response.headers.setdefault(nombre, valor)
    if es_produccion(settings):
        response.headers.setdefault("Strict-Transport-Security", HSTS)
    return response


API_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=f"{API_PREFIX}/auth", tags=["auth"])
app.include_router(eventos.router, prefix=f"{API_PREFIX}/events", tags=["eventos"])
app.include_router(dashboard.router, prefix=f"{API_PREFIX}/dashboard", tags=["dashboard"])
app.include_router(mapa.router, prefix=f"{API_PREFIX}", tags=["mapa"])
app.include_router(analisis.router, prefix=f"{API_PREFIX}/analytics", tags=["analisis"])
app.include_router(datasets.router, prefix=f"{API_PREFIX}/datasets", tags=["datasets"])
app.include_router(ml.router, prefix=f"{API_PREFIX}/ml", tags=["ml"])
app.include_router(estimaciones.router, prefix=f"{API_PREFIX}/estimates", tags=["estimaciones"])
app.include_router(alert_rules.router, prefix=f"{API_PREFIX}/alert-rules", tags=["alert-rules"])
app.include_router(alerts.router, prefix=f"{API_PREFIX}/alerts", tags=["alerts"])
app.include_router(fuentes.router, prefix=f"{API_PREFIX}/sources", tags=["fuentes"])
app.include_router(reportes.router, prefix=f"{API_PREFIX}/reports", tags=["reportes"])
app.include_router(usuarios.router, prefix=f"{API_PREFIX}/users", tags=["usuarios"])
app.include_router(usuarios.roles_router, prefix=API_PREFIX, tags=["usuarios"])
app.include_router(auditoria.router, prefix=f"{API_PREFIX}/audit-logs", tags=["auditoria"])
app.include_router(configuracion.router, prefix=f"{API_PREFIX}/settings", tags=["configuracion"])


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}


@app.get(f"{API_PREFIX}/meta")
async def meta(db: AsyncSession = Depends(get_db)):
    """Metadatos del sistema.

    `data_min_day`/`data_max_day`/`last_sync_at` se calculan del catálogo real
    (nunca de valores fijos del cliente).
    """
    from datetime import timedelta, timezone

    from app.core.clock import now as clock_now

    mn = await db.scalar(select(func.min(SeismicEvent.occurred_at)))
    mx = await db.scalar(select(func.max(SeismicEvent.occurred_at)))
    last = await db.scalar(select(func.max(IngestionRun.finished_at)))

    u5 = timezone(timedelta(hours=-5))
    return {
        "version": "0.1.0",
        "generated_at": clock_now().isoformat().replace("+00:00", "Z"),
        "data_min_day": mn.astimezone(u5).date().isoformat() if mn else None,
        "data_max_day": mx.astimezone(u5).date().isoformat() if mx else None,
        "last_sync_at": last.isoformat().replace("+00:00", "Z") if last else None,
    }
