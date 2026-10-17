from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
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
)

app = FastAPI(
    title="Sistema de Monitoreo Sísmico API",
    version="0.1.0",
    description="API para monitoreo de eventos sísmicos, análisis y alertas",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
app.include_router(auditoria.router, prefix=f"{API_PREFIX}/audit-logs", tags=["auditoria"])


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}
