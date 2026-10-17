import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import __version__
from app.core.config import settings
from app.db.database import get_db

log = logging.getLogger("sismo.health")
router = APIRouter()


@router.get("")
def liveness() -> dict:
    """El proceso responde. No toca la base: sirve para que el hosting sepa que el servicio vive."""
    return {"status": "ok", "version": __version__, "environment": settings.ENVIRONMENT}


@router.get("/ready")
def readiness(response: Response, db: Session = Depends(get_db)) -> dict:
    """La API puede atender: comprueba la base de datos y mide su latencia."""
    started = time.perf_counter()
    try:
        db.execute(text("SELECT 1"))
        database = {"ok": True, "latency_ms": round((time.perf_counter() - started) * 1000, 1)}
    except Exception:
        # El motivo va al log, no al cliente
        log.exception("La base de datos no responde")
        response.status_code = 503
        database = {"ok": False, "latency_ms": None}
    return {
        "status": "ok" if database["ok"] else "degraded",
        "version": __version__,
        "environment": settings.ENVIRONMENT,
        "database": database,
        "server_time_utc": datetime.now(timezone.utc).isoformat(),
    }
