"""Servicio de ingesta de datos sísmicos.

Empaqueta la lógica **pura** de ingesta (conector → normalizador → motor) sin
depender del framework ni de la base de datos:

    ingestion.connectors   → de dónde salen los datos (fuente real pendiente)
    ingestion.normalizers  → cómo se validan y mapean a `NormalizedEvent`
    ingestion.engine       → orquesta la sincronización y reporta el resultado

La capa de persistencia (SQLAlchemy) y los endpoints viven en `services/api`,
que reutiliza este paquete. Al integrar la fuente real basta con implementar un
`Connector` nuevo; el resto no cambia.
"""

from ingestion.engine import run_sync
from ingestion.models import NormalizedEvent, SyncReport
from ingestion.validation import origin_hash, validar

__all__ = ["run_sync", "NormalizedEvent", "SyncReport", "origin_hash", "validar"]
