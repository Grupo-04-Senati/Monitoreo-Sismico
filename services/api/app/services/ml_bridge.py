"""Punto único de importación del paquete de ML (`services/ml`).

`ensure_ingestion_on_path` agrega `services/` al `sys.path`, carpeta que contiene
tanto `ingestion` como `ml`:

    from app.services.ml_bridge import conteo_semanal, regresion_lineal, ErrorEntrenamiento
"""

from __future__ import annotations

from pathlib import Path

from app.core.config import settings
from app.core.paths import ensure_ingestion_on_path

ensure_ingestion_on_path()

import ml  # noqa: E402
from ml.training import conteo_semanal, regresion_lineal  # noqa: E402
from ml.training.base import ErrorEntrenamiento, Resultado, versiones  # noqa: E402
from ml.features.conteo_semanal import conteos_semanales, inicio_semana  # noqa: E402
from ml.inference import conteo_semanal as inferencia_conteo  # noqa: E402


def carpeta_artefactos() -> Path:
    """Dónde se guardan los modelos entrenados (no se versionan en git)."""
    carpeta = Path(settings.ML_ARTIFACTS_DIR) if settings.ML_ARTIFACTS_DIR else Path(ml.__file__).parent / "artifacts"
    carpeta.mkdir(parents=True, exist_ok=True)
    return carpeta


__all__ = [
    "conteo_semanal",
    "regresion_lineal",
    "ErrorEntrenamiento",
    "Resultado",
    "versiones",
    "carpeta_artefactos",
    "conteos_semanales",
    "inicio_semana",
    "inferencia_conteo",
]
