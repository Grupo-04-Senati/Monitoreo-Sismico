from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import time
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
    perfil,
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
    demo,
    monitoreo,
)
from app.services.audit import esperar_auditoria
from app.services.monitoreo import latencias


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
    inicio = time.perf_counter()
    try:
        response = await call_next(request)
    finally:
        correlation_id_actual.reset(token)
    if request.url.path.startswith("/api/"):
        latencias.registrar((time.perf_counter() - inicio) * 1000, response.status_code)
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
app.include_router(perfil.router, prefix=f"{API_PREFIX}/me", tags=["perfil"])
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
app.include_router(monitoreo.router, prefix=f"{API_PREFIX}/monitoring", tags=["monitoreo"])
app.include_router(demo.router, prefix=f"{API_PREFIX}/demo", tags=["demo"])


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/health/ready")
async def readiness(db: AsyncSession = Depends(get_db)):
    """Para monitores externos: 200 si la base responde, 503 si no. No expone datos."""
    from fastapi.responses import JSONResponse

    try:
        await db.execute(select(1))
    except Exception:  # noqa: BLE001 - cualquier fallo de la base es "no listo"
        return JSONResponse(status_code=503, content={"status": "sin_base_de_datos"})
    return {"status": "ok"}


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
        **await _resumen_fuente(db),
    }


async def _resumen_fuente(db: AsyncSession) -> dict:
    """Estado público de la fuente para la barra superior, el Dashboard y la procedencia.

    Lo ven todos los roles (no es dato sensible): nombre, licencia, estado del conector
    y último éxito. El detalle (ejecuciones, configuración) sigue en /sources. El
    simulador de la demo (D29) no cuenta como fuente.
    """
    from app.db.models import DataSource
    from app.services.simulacion import CLAVE_FUENTE as CLAVE_SIMULADOR
    from app.services.sources import calcular_resumen, listar_runs

    fuentes = list(
        (
            await db.execute(
                select(DataSource).where(DataSource.key != CLAVE_SIMULADOR).order_by(DataSource.created_at)
            )
        ).scalars()
    )
    principal = next((f for f in fuentes if f.enabled), fuentes[0] if fuentes else None)
    resumen = None
    if principal is not None:
        estado = calcular_resumen(await listar_runs(db, principal.id, limite=20))
        resumen = {
            "nombre": principal.name,
            "organizacion": principal.organization,
            "licencia": principal.license,
            "estado_conector": estado.estado_conector,
            "estado_detalle": estado.estado_conector_detalle,
            "ultimo_exito": estado.ultimo_exito.isoformat().replace("+00:00", "Z") if estado.ultimo_exito else None,
        }
    return {
        "fuente": resumen,
        "fuentes": {"total": len(fuentes), "habilitadas": sum(1 for f in fuentes if f.enabled)},
    }


# ── Web compilada servida por la propia API (despliegue de un solo servicio, D29) ──
# Solo si WEB_DIST_DIR apunta a `apps/web/dist`. Va al final: las rutas de la API y
# /health tienen prioridad; cualquier otra ruta devuelve la app (enrutado del navegador).
if settings.WEB_DIST_DIR:
    from pathlib import Path as _Path

    from fastapi import HTTPException as _HTTPException
    from fastapi.responses import FileResponse as _FileResponse
    from fastapi.staticfiles import StaticFiles as _StaticFiles

    _WEB = _Path(settings.WEB_DIST_DIR).resolve()
    if (_WEB / "index.html").is_file():
        if (_WEB / "assets").is_dir():
            app.mount("/assets", _StaticFiles(directory=_WEB / "assets"), name="assets")
        _CSP = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; "
            "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"
        )

        @app.api_route("/{ruta:path}", methods=["GET", "HEAD"], include_in_schema=False)
        async def web_compilada(ruta: str):
            if ruta.startswith("api/"):
                raise _HTTPException(status_code=404, detail="Not Found")
            archivo = (_WEB / ruta).resolve()
            if ruta and archivo.is_file() and archivo.is_relative_to(_WEB):
                return _FileResponse(archivo)
            return _FileResponse(_WEB / "index.html", headers={"Cache-Control": "no-cache", "Content-Security-Policy": _CSP})

