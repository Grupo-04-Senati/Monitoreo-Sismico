"""Métricas de evaluación (PDF §10): regresión con MAE, RMSE y R²."""

from __future__ import annotations

import math


def regresion(reales: list[float], estimados: list[float]) -> dict[str, float | None]:
    """MAE, RMSE y R² (R² es `None` si los valores reales no varían)."""
    n = len(reales)
    if n == 0:
        return {"mae": None, "rmse": None, "r2": None, "n": 0}
    errores = [e - r for r, e in zip(reales, estimados)]
    mae = sum(abs(x) for x in errores) / n
    rmse = math.sqrt(sum(x * x for x in errores) / n)
    media = sum(reales) / n
    total = sum((r - media) ** 2 for r in reales)
    r2 = None if total == 0 else 1 - sum(x * x for x in errores) / total
    return {"mae": round(mae, 4), "rmse": round(rmse, 4), "r2": None if r2 is None else round(r2, 4), "n": n}


def mejora(mae_modelo: float | None, mae_referencia: float | None) -> float | None:
    """Mejora relativa del MAE frente a una referencia (positiva = mejor)."""
    if mae_modelo is None or not mae_referencia:
        return None
    return round(1 - mae_modelo / mae_referencia, 4)


__all__ = ["regresion", "mejora"]
