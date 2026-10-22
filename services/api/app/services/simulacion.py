"""Simulador de sismos para demostraciones (decisión D29).

Solo existe con `DEMO_SIMULACION=true` (despliegue de demostración). Crea sismos
**ficticios** y los hace pasar por el mismo camino que uno real: una ejecución de
ingesta propia, el repositorio (departamento derivado, idempotencia), el motor de
avisos con las reglas activas y la auditoría. Así se puede mostrar en vivo la cadena
"llega un sismo → aviso → aprobación" sin esperar a que tiemble.

Nunca se confunden con datos reales: vienen de la fuente "Simulador de demostración
(datos ficticios)" (deshabilitada para la sincronización) y su lugar empieza con
"[SIMULADO]" en todas las pantallas.
"""

from __future__ import annotations

import math
import random
import uuid
from datetime import timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now
from app.core.config import settings
from app.db.models import Alert, DataSource, User
from app.services.audit import registrar_auditoria
from app.services.ingestion_bridge import NormalizedEvent, SyncReport
from app.services.ingestion_runner import RepositorioEventos, finalizar_ejecucion, iniciar_ejecucion

CLAVE_FUENTE = "simulacion"
NOMBRE_FUENTE = "Simulador de demostración (datos ficticios)"
PREFIJO_LUGAR = "[SIMULADO]"

#: Zonas de ejemplo (centro y radio de dispersión). Todas dentro del recuadro del Perú.
ZONAS: dict[str, dict[str, Any]] = {
    "mina_arequipa": {"nombre": "Mina Arequipa", "lat": -16.40, "lon": -71.50, "radio_km": 40},
    "costa_lima": {"nombre": "costa de Lima", "lat": -12.30, "lon": -77.30, "radio_km": 40},
    "mar_ica": {"nombre": "mar frente a Ica", "lat": -14.70, "lon": -76.50, "radio_km": 30},
    "tacna": {"nombre": "Tacna", "lat": -17.90, "lon": -70.60, "radio_km": 30},
    "cusco": {"nombre": "Cusco", "lat": -13.50, "lon": -71.95, "radio_km": 30},
}


def activo() -> bool:
    return bool(settings.DEMO_SIMULACION)


async def _fuente(db: AsyncSession) -> DataSource:
    fuente = (await db.execute(select(DataSource).where(DataSource.key == CLAVE_FUENTE))).scalar_one_or_none()
    if fuente is None:
        fuente = DataSource(
            key=CLAVE_FUENTE, name=NOMBRE_FUENTE, organization="Demostración de la plataforma (no es una fuente real)",
            kind="Simulador interno", url_api=None, frequency_min=15, enabled=False, notify_errors=False,
        )
        db.add(fuente)
        await db.commit()
        await db.refresh(fuente)
    return fuente


def _punto(zona: dict[str, Any], rng: random.Random) -> tuple[float, float, float]:
    """Punto al azar dentro del radio de la zona; devuelve (lat, lon, km al centro)."""
    distancia = zona["radio_km"] * math.sqrt(rng.random())
    angulo = rng.uniform(0, 2 * math.pi)
    dlat = distancia / 111.0 * math.cos(angulo)
    dlon = distancia / (111.0 * math.cos(math.radians(zona["lat"]))) * math.sin(angulo)
    return round(zona["lat"] + dlat, 4), round(zona["lon"] + dlon, 4), distancia


async def simular(
    db: AsyncSession, actor: User, *, zona: str, magnitud: float, cantidad: int, correlation_id: str | None
) -> dict[str, Any]:
    if not activo():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulación no disponible")
    if zona not in ZONAS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Zona desconocida")

    from ingestion.geografia import departamento  # paquete hermano (ver ingestion_bridge)
    from ingestion.validation import origin_hash

    fuente = await _fuente(db)
    run = await iniciar_ejecucion(db, fuente, triggered_by="simulacion", actor_id=actor.id, correlation_id=correlation_id)
    repo = RepositorioEventos(db, fuente.id)
    rng = random.Random()
    ahora = clock_now()
    z = ZONAS[zona]
    creados = []
    for i in range(cantidad):
        lat, lon, km = _punto(z, rng)
        # Réplicas: la primera con la magnitud pedida; las siguientes algo menores.
        mag = round(max(2.5, magnitud - (rng.uniform(0.3, 1.2) if i else 0)), 1)
        profundidad = round(rng.uniform(15, 110), 1)
        ocurrido = ahora - timedelta(seconds=45 - i * 5)
        externo = f"sim-{uuid.uuid4().hex[:12]}"
        lugar = f"{PREFIJO_LUGAR} {km:.0f} km del centro de {z['nombre']}, Peru"
        evento = NormalizedEvent(
            external_id=externo, occurred_at=ocurrido, latitude=lat, longitude=lon, depth_km=profundidad,
            magnitude=mag, magnitude_type="ML", region=departamento(lat, lon, lugar),
            origin_hash=origin_hash(source_key=CLAVE_FUENTE, external_id=externo, occurred_at=ocurrido,
                                    latitude=lat, longitude=lon, depth_km=profundidad, magnitude=mag),
            received_at=ahora, locality=lugar, source_url=None, review_status="pendiente_validacion",
            raw={"simulado": True, "zona": zona}, source_updated_at=ahora,
        )
        await repo.upsert(evento)
        creados.append({"external_id": externo, "magnitud": mag, "profundidad_km": profundidad,
                        "region": evento.region, "lat": lat, "lon": lon})

    reporte = SyncReport(leidos=cantidad, insertados=cantidad, http_status=200)
    run = await finalizar_ejecucion(db, run, reporte)

    from app.services.alertas_motor import evaluar_insertados_desde

    antes = {a for a in (await db.execute(select(Alert.id))).scalars()}
    await evaluar_insertados_desde(db, run.started_at)
    nuevos = [a for a in (await db.execute(select(Alert))).scalars() if a.id not in antes]

    registrar_auditoria(
        actor_id=actor.id, action="sismo_simulado", entity_type="data_source", entity_id=fuente.id,
        after={"zona": zona, "cantidad": cantidad, "magnitud": magnitud, "avisos": len(nuevos)},
        correlation_id=correlation_id,
    )
    return {
        "sismos": creados,
        "ejecucion_id": run.id,
        "avisos": [{"id": a.id, "titulo": a.title, "estado": a.status} for a in nuevos],
        "nota": "Datos ficticios para la demostración: aparecen como [SIMULADO] y con su propia fuente.",
    }


__all__ = ["ZONAS", "activo", "simular", "NOMBRE_FUENTE", "PREFIJO_LUGAR"]
