import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.core.config import settings
from app.core.errors import register_error_handlers
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
    health,
)

app = FastAPI(
    title="Sistema de Monitoreo Sísmico API",
    version=__version__,
    description="API para monitoreo de eventos sísmicos, análisis y alertas. No emite alertas oficiales.",
    # En produccion se apaga la documentacion interactiva
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Requested-With", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)


@app.middleware("http")
async def correlation_id(request: Request, call_next):
    """Cada solicitud lleva un id que viaja en la respuesta y en los logs (se usara en la auditoria)."""
    cid = request.headers.get("X-Request-ID", "")[:64] or uuid.uuid4().hex
    request.state.correlation_id = cid
    response = await call_next(request)
    response.headers["X-Request-ID"] = cid
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response


register_error_handlers(app)

API_PREFIX = "/api/v1"

app.include_router(health.router, prefix=f"{API_PREFIX}/health", tags=["salud"])
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
app.include_router(auditoria.router, prefix=f"{API_PREFIX}/audit-logs", tags=["auditoria"])


@app.get("/health")
def health_check():
    return {"status": "ok", "version": __version__}
