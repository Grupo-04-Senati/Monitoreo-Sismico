"""Tipos comunes del entrenamiento: resultado, error y versiones de librerías."""

from __future__ import annotations

import platform
from dataclasses import dataclass, field
from typing import Any


class ErrorEntrenamiento(Exception):
    """El experimento no se puede entrenar con esos datos (motivo legible)."""


@dataclass
class Resultado:
    tarea: str
    #: Modelo con menor MAE en la partición de prueba (puede ser una referencia).
    mejor: str
    #: Métricas en prueba por modelo: {"modelo": {"mae", "rmse", "r2", "n"}}.
    metricas: dict[str, dict[str, Any]]
    #: Mejora relativa del MAE de cada modelo frente a cada referencia.
    mejora: dict[str, dict[str, float | None]]
    variables: list[str]
    objetivo: str
    validacion: dict[str, Any]
    #: Real frente a estimado en prueba (para la curva real-vs-estimada).
    serie_prueba: list[dict[str, Any]] = field(default_factory=list)
    coeficientes: dict[str, Any] = field(default_factory=dict)
    advertencias: list[str] = field(default_factory=list)
    limitaciones: list[str] = field(default_factory=list)
    #: Objetos entrenados (se guardan como artefacto; no van a la base).
    modelos: dict[str, Any] = field(default_factory=dict)


def versiones() -> dict[str, str]:
    """Versiones con las que se entrenó (reproducibilidad, PDF §7)."""
    import joblib
    import numpy
    import sklearn

    return {
        "python": platform.python_version(),
        "numpy": numpy.__version__,
        "scikit-learn": sklearn.__version__,
        "joblib": joblib.__version__,
    }


__all__ = ["ErrorEntrenamiento", "Resultado", "versiones"]
