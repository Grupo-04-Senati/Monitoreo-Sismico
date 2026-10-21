"""Tipos del servicio de ingesta.

Estos objetos son puros (sin dependencias de framework ni de base de datos) de
modo que la misma lógica corre en el worker de Celery, en una CLI o en las
pruebas. La persistencia se inyecta mediante un repositorio.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

#: Estados de una ejecución de ingesta (mismos que expone la API).
ESTADO_EN_CURSO = "en_curso"
ESTADO_CORRECTA = "correcta"
ESTADO_CON_ERRORES = "con_errores"
ESTADO_FALLIDA = "fallida"


@dataclass(frozen=True)
class NormalizedEvent:
    """Evento sísmico ya validado y normalizado, listo para persistir."""

    external_id: str
    occurred_at: datetime
    latitude: float
    longitude: float
    depth_km: float | None
    magnitude: float | None
    magnitude_type: str | None
    region: str | None
    origin_hash: str
    #: Momento en que la fuente reportó el evento (opcional).
    received_at: datetime | None = None
    #: Referencia textual del epicentro (p. ej. "12 km al SO de Callao").
    locality: str | None = None
    #: Enlace de procedencia del evento en la fuente, si el proveedor lo entrega.
    source_url: str | None = None
    #: "observado" | "pendiente_validacion".
    review_status: str = "observado"
    raw: dict[str, Any] = field(default_factory=dict)
    #: Última modificación del evento en la fuente (USGS `properties.updated`). Una versión
    #: con fecha más nueva y valores distintos se aplica como revisión (D27).
    source_updated_at: datetime | None = None


@dataclass
class SyncReport:
    """Resultado de una sincronización. Alimenta a `ingestion_runs`."""

    leidos: int = 0
    insertados: int = 0
    #: Eventos ya guardados que la fuente corrigió (revisiones aplicadas, D27).
    actualizados: int = 0
    duplicados: int = 0
    rechazados: int = 0
    latencia_ms: int = 0
    intentos: int = 1
    http_status: int | None = None
    error: str | None = None
    motivos_rechazo: list[str] = field(default_factory=list)

    @property
    def estado(self) -> str:
        if self.error:
            return ESTADO_FALLIDA
        if self.rechazados or self.motivos_rechazo:
            return ESTADO_CON_ERRORES
        return ESTADO_CORRECTA


__all__ = [
    "ESTADO_EN_CURSO",
    "ESTADO_CORRECTA",
    "ESTADO_CON_ERRORES",
    "ESTADO_FALLIDA",
    "NormalizedEvent",
    "SyncReport",
]
