"""Punto único de importación del paquete de ingesta.

Aísla el ajuste de `sys.path` (`ensure_ingestion_on_path`) para que el resto de la
API importe el motor desde aquí:

    from app.services.ingestion_bridge import PendienteConnector, IgpNormalizer, run_sync
"""

from __future__ import annotations

from app.core.paths import ensure_ingestion_on_path

ensure_ingestion_on_path()

from ingestion.connectors.pendiente import PendienteConnector  # noqa: E402
from ingestion.engine import EventRepository, run_sync  # noqa: E402
from ingestion.models import NormalizedEvent, SyncReport  # noqa: E402
from ingestion.normalizers.igp import IgpNormalizer  # noqa: E402

__all__ = [
    "PendienteConnector",
    "IgpNormalizer",
    "NormalizedEvent",
    "SyncReport",
    "run_sync",
    "EventRepository",
]
