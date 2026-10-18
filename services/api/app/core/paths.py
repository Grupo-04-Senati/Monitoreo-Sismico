"""Puente hacia el paquete de ingesta (`services/ingestion`).

El motor de ingesta vive en el servicio `services/ingestion` (lógica pura). Aquí
se localiza esa carpeta y se agrega su directorio padre al `sys.path` para poder
importarla desde la API y desde el worker de Celery sin empaquetarla.

Se buscan dos disposiciones habituales subiendo por los directorios padre:

    <raíz>/services/ingestion        (repositorio)
    <raíz>/ingestion                 (imagen de contenedor)
"""

from __future__ import annotations

import sys
from pathlib import Path


def ingestion_dir() -> Path | None:
    """Localiza `services/ingestion`; `None` si no está disponible."""
    for base in Path(__file__).resolve().parents:
        for candidato in (base / "services" / "ingestion", base / "ingestion"):
            if (candidato / "__init__.py").is_file():
                return candidato
    return None


def ensure_ingestion_on_path() -> Path | None:
    """Agrega el directorio padre de `ingestion` a `sys.path` (idempotente)."""
    carpeta = ingestion_dir()
    if carpeta is None:
        return None
    padre = str(carpeta.parent)
    if padre not in sys.path:
        sys.path.insert(0, padre)
    return carpeta


__all__ = ["ensure_ingestion_on_path", "ingestion_dir"]
