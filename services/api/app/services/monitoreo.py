"""Estado operativo del sistema (PDF §12: monitorear fuentes, retraso de ingesta, fallos
de tareas, latencia de la API y entregas de alertas; Fase 9: monitorización).

Cada comprobación devuelve `ok`, `aviso`, `critico` o `sin_datos`, con un detalle en
lenguaje llano y los números en que se basa. Los umbrales están aquí, a la vista.
La latencia se mide en este proceso (se reinicia al reiniciar la API).
"""

from __future__ import annotations

import time
from collections import deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now
from app.core.config import settings
from app.db.models import Alert, AlertStatus, DataSource, IngestionRun, RunStatus
from app.services import login_throttle

#: Retraso de la ingesta (en múltiplos de la frecuencia de la fuente) para avisar y para alarmar.
RETRASO_AVISO = 2
RETRASO_CRITICO = 6
#: Margen fijo sobre el retraso (una sincronización tarda unos minutos).
MARGEN_MIN = 5
#: Ejecución "en curso" más vieja que esto: probablemente quedó colgada.
COLGADA_MIN = 30
#: Avisos pendientes de aprobación más viejos que esto.
PENDIENTE_MAX_MIN = 60
#: Latencia p95 de la API que merece aviso.
P95_AVISO_MS = 1000
#: Antigüedad de la última copia de seguridad (horas).
COPIA_AVISO_H = 26
COPIA_CRITICO_H = 50

ORDEN = {"ok": 0, "sin_datos": 1, "aviso": 2, "critico": 3}


class _Latencias:
    """Últimas peticiones a /api de este proceso: duración y si fallaron con 5xx."""

    def __init__(self, tamano: int = 2000) -> None:
        self.muestras: deque[tuple[float, int]] = deque(maxlen=tamano)
        self.desde = datetime.now(timezone.utc)

    def registrar(self, ms: float, status: int) -> None:
        self.muestras.append((ms, status))

    def resumen(self) -> dict[str, Any]:
        valores = sorted(m for m, _ in self.muestras)
        n = len(valores)

        def percentil(p: float) -> float | None:
            return round(valores[min(n - 1, int(p * n))], 1) if n else None

        return {
            "peticiones": n,
            "p50_ms": percentil(0.50),
            "p95_ms": percentil(0.95),
            "errores_5xx": sum(1 for _, s in self.muestras if s >= 500),
            "desde": self.desde,
        }


latencias = _Latencias()


def _c(clave: str, nombre: str, estado: str, detalle: str, **datos: Any) -> dict[str, Any]:
    return {"clave": clave, "nombre": nombre, "estado": estado, "detalle": detalle, "datos": datos}


def _minutos(delta: timedelta) -> int:
    return int(delta.total_seconds() // 60)


async def _base_datos(db: AsyncSession) -> dict[str, Any]:
    inicio = time.perf_counter()
    await db.execute(text("SELECT 1"))
    ms = round((time.perf_counter() - inicio) * 1000, 1)
    estado = "ok" if ms < 200 else "aviso"
    return _c("base_datos", "Base de datos", estado, f"Responde en {ms} ms.", ms=ms)


async def _ingesta(db: AsyncSession, ahora: datetime) -> list[dict[str, Any]]:
    fuentes = (await db.execute(select(DataSource).where(DataSource.enabled.is_(True)))).scalars().all()
    if not fuentes:
        return [_c("ingesta", "Ingesta", "critico", "No hay ninguna fuente de datos habilitada.")]
    salida = []
    for f in fuentes:
        ultima = await db.scalar(
            select(func.max(IngestionRun.finished_at)).where(
                IngestionRun.source_id == f.id,
                IngestionRun.status.in_((RunStatus.CORRECTA, RunStatus.CON_ERRORES)),
            )
        )
        nombre = f"Ingesta · {f.name}"
        if ultima is None:
            salida.append(_c(f"ingesta_{f.key}", nombre, "critico", "Nunca se sincronizó correctamente.", frecuencia_min=f.frequency_min))
            continue
        retraso = _minutos(ahora - ultima)
        if retraso <= RETRASO_AVISO * f.frequency_min + MARGEN_MIN:
            estado, texto = "ok", f"Última sincronización correcta hace {retraso} min (frecuencia: {f.frequency_min} min)."
        else:
            estado = "aviso" if retraso <= RETRASO_CRITICO * f.frequency_min + MARGEN_MIN else "critico"
            texto = (
                f"Sin sincronizar desde hace {retraso} min (frecuencia: {f.frequency_min} min). "
                "Revise que el worker y el programador de Celery estén corriendo y que la fuente responda."
            )
        salida.append(_c(f"ingesta_{f.key}", nombre, estado, texto, retraso_min=retraso, frecuencia_min=f.frequency_min, ultima=ultima))
    return salida


async def _ejecuciones(db: AsyncSession, ahora: datetime) -> dict[str, Any]:
    fallidas = await db.scalar(
        select(func.count()).select_from(IngestionRun).where(
            IngestionRun.status == RunStatus.FALLIDA, IngestionRun.started_at >= ahora - timedelta(hours=24)
        )
    ) or 0
    colgadas = await db.scalar(
        select(func.count()).select_from(IngestionRun).where(
            IngestionRun.status == RunStatus.EN_CURSO, IngestionRun.started_at < ahora - timedelta(minutes=COLGADA_MIN)
        )
    ) or 0
    if fallidas == 0 and colgadas == 0:
        return _c("ejecuciones", "Ejecuciones de ingesta", "ok", "Sin fallos en las últimas 24 h.", fallidas_24h=0, colgadas=0)
    partes = []
    if fallidas:
        partes.append(f"{fallidas} fallida{'s' if fallidas != 1 else ''} en 24 h")
    if colgadas:
        partes.append(f"{colgadas} en curso desde hace más de {COLGADA_MIN} min")
    return _c(
        "ejecuciones", "Ejecuciones de ingesta", "aviso",
        f"{'; '.join(partes).capitalize()}. Detalle en Fuentes de datos.", fallidas_24h=fallidas, colgadas=colgadas,
    )


async def _avisos(db: AsyncSession, ahora: datetime) -> dict[str, Any]:
    fallidos = await db.scalar(select(func.count()).select_from(Alert).where(Alert.status == AlertStatus.FALLIDA)) or 0
    pendientes = await db.scalar(
        select(func.count()).select_from(Alert).where(Alert.status == AlertStatus.PENDIENTE_APROBACION)
    ) or 0
    mas_viejo = await db.scalar(
        select(func.min(Alert.created_at)).where(Alert.status == AlertStatus.PENDIENTE_APROBACION)
    )
    espera = _minutos(ahora - mas_viejo) if mas_viejo else 0
    datos = {"entregas_fallidas": fallidos, "pendientes": pendientes, "espera_max_min": espera}
    problemas = []
    if fallidos:
        problemas.append(f"{fallidos} con entrega fallida")
    if pendientes and espera > PENDIENTE_MAX_MIN:
        problemas.append(f"{pendientes} pendiente{'s' if pendientes != 1 else ''} de aprobación (el más antiguo hace {espera} min)")
    if not problemas:
        texto = f"{pendientes} pendiente{'s' if pendientes != 1 else ''} de aprobación, ninguno atrasado." if pendientes else "Sin avisos por atender."
        return _c("avisos", "Avisos internos", "ok", texto, **datos)
    return _c("avisos", "Avisos internos", "aviso", f"{'; '.join(problemas).capitalize()}. Revise el Centro de alertas.", **datos)


def _latencia() -> dict[str, Any]:
    r = latencias.resumen()
    if r["peticiones"] < 20:
        return _c("latencia", "Latencia de la API", "sin_datos", f"Pocas peticiones desde el arranque ({r['peticiones']}).", **r)
    problemas = []
    if r["p95_ms"] is not None and r["p95_ms"] > P95_AVISO_MS:
        problemas.append(f"p95 de {r['p95_ms']} ms (más de {P95_AVISO_MS} ms)")
    if r["errores_5xx"]:
        problemas.append(f"{r['errores_5xx']} errores del servidor (5xx)")
    texto = f"p50 {r['p50_ms']} ms · p95 {r['p95_ms']} ms en las últimas {r['peticiones']} peticiones."
    if problemas:
        return _c("latencia", "Latencia de la API", "aviso", f"{texto} {'; '.join(problemas).capitalize()}.", **r)
    return _c("latencia", "Latencia de la API", "ok", texto, **r)


def _limite_acceso() -> dict[str, Any]:
    """Dónde se cuentan los intentos de acceso (D25)."""
    import os

    est = login_throttle.estado()
    procesos = int(os.environ.get("API_WORKERS", "1") or 1)
    nombre = "Límite de intentos de acceso"
    if est["almacen"] == "redis":
        return _c("limite_acceso", nombre, "ok", "Contado en Redis, compartido entre procesos.", procesos=procesos, almacen=est["almacen"], motivo=est["detalle"])
    if procesos > 1:
        return _c(
            "limite_acceso", nombre, "aviso",
            f"Contado en memoria con {procesos} procesos: cada proceso cuenta por separado. {est['detalle']}.",
            procesos=procesos, almacen=est["almacen"], motivo=est["detalle"],
        )
    return _c("limite_acceso", nombre, "ok", f"En memoria con un solo proceso ({est['detalle']}).", procesos=procesos, almacen=est["almacen"], motivo=est["detalle"])


def _copias(ahora: datetime) -> dict[str, Any]:
    carpeta = settings.MONITOREO_BACKUP_DIR
    if not carpeta:
        return _c("copias", "Copias de seguridad", "sin_datos", "No configurado en este entorno (MONITOREO_BACKUP_DIR).")
    ruta = Path(carpeta)
    archivos = sorted(ruta.glob("*.dump"), key=lambda p: p.stat().st_mtime, reverse=True) if ruta.is_dir() else []
    if not archivos:
        return _c("copias", "Copias de seguridad", "critico", f"No hay copias en {carpeta}.")
    ultima = datetime.fromtimestamp(archivos[0].stat().st_mtime, tz=timezone.utc)
    horas = round((ahora - ultima).total_seconds() / 3600, 1)
    estado = "ok" if horas <= COPIA_AVISO_H else "aviso" if horas <= COPIA_CRITICO_H else "critico"
    return _c(
        "copias", "Copias de seguridad", estado,
        f"Última copia hace {horas} h ({len(archivos)} guardadas, {archivos[0].stat().st_size // 1024} KB).",
        horas=horas, copias=len(archivos), ultima=ultima,
    )


async def estado(db: AsyncSession) -> dict[str, Any]:
    ahora = clock_now()
    comprobaciones = [await _base_datos(db)]
    comprobaciones += await _ingesta(db, ahora)
    comprobaciones += [await _ejecuciones(db, ahora), await _avisos(db, ahora), _latencia(), _limite_acceso(), _copias(ahora)]
    peor = max((c["estado"] for c in comprobaciones), key=ORDEN.__getitem__)
    general = {"ok": "ok", "sin_datos": "ok", "aviso": "degradado", "critico": "critico"}[peor]
    return {"estado": general, "generado_en": ahora, "comprobaciones": comprobaciones}


__all__ = ["latencias", "estado"]
