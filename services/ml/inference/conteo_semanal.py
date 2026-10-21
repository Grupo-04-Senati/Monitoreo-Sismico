"""Estimación del conteo de sismos de una semana con un modelo ya entrenado.

Se usan las mismas variables que en el entrenamiento (`ml.features.conteo_semanal`),
calculadas con las semanas completas **anteriores** a la que se estima.

La incertidumbre no sale de una fórmula teórica: se toma de los errores reales
que tuvo el modelo en su partición de prueba (cuantiles de real − estimado). Así
el intervalo refleja la dispersión por réplicas, que un intervalo de Poisson
subestimaría. Si el modelo erraba mucho, el intervalo es ancho, y eso se muestra.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from ml.features.conteo_semanal import NOMBRES, REZAGOS, VENTANA_MEDIA

#: Nivel del intervalo (cuantiles 5 % y 95 % de los errores en prueba).
NIVEL = 0.90
#: Semanas completas que hacen falta antes de la semana estimada.
SEMANAS_NECESARIAS = max(max(REZAGOS), VENTANA_MEDIA)


class ErrorEstimacion(Exception):
    """No se puede estimar con estos datos (motivo legible)."""


def variables_semana_siguiente(conteos: list[int]) -> list[float]:
    """Variables para estimar la semana que sigue a `conteos` (el último es la semana anterior)."""
    if len(conteos) < SEMANAS_NECESARIAS:
        raise ErrorEstimacion(
            f"Hacen falta {SEMANAS_NECESARIAS} semanas completas previas; hay {len(conteos)}."
        )
    rezagos = [float(conteos[-r]) for r in REZAGOS]
    media = sum(conteos[-VENTANA_MEDIA:]) / VENTANA_MEDIA
    return rezagos + [media]


def errores_de_prueba(serie_prueba: list[dict[str, Any]], modelo: str) -> list[float]:
    """Errores (real − estimado) del modelo en su partición de prueba."""
    errores = [float(p["real"]) - float(p[modelo]) for p in serie_prueba if modelo in p and "real" in p]
    if len(errores) < 10:
        raise ErrorEstimacion("El experimento no guarda suficientes errores de prueba para el intervalo.")
    return errores


def estimar(modelo: Any, conteos: list[int], errores: list[float], nombre_modelo: str) -> dict[str, Any]:
    """Valor estimado e intervalo empírico del 90 % (nunca por debajo de 0)."""
    x = np.array([variables_semana_siguiente(conteos)], dtype=float)
    valor = float(modelo.predict(x)[0])
    if nombre_modelo == "regresion_lineal":
        valor = max(0.0, valor)  # igual que en el entrenamiento: un conteo no es negativo
    bajo, alto = np.quantile(np.array(errores), [(1 - NIVEL) / 2, 1 - (1 - NIVEL) / 2])
    return {
        "valor": round(valor, 2),
        "inferior": round(max(0.0, valor + float(bajo)), 2),
        "superior": round(max(0.0, valor + float(alto)), 2),
        "nivel": NIVEL,
        "variables": dict(zip(NOMBRES, (round(float(v), 4) for v in x[0]))),
        # round(): con int(), 0.05 * 100 = 4.999… daría "4 %".
        "metodo": f"cuantiles {round((1 - NIVEL) / 2 * 100)}–{round((1 - (1 - NIVEL) / 2) * 100)} % de los errores en prueba",
        "errores_usados": len(errores),
    }


__all__ = ["NIVEL", "SEMANAS_NECESARIAS", "ErrorEstimacion", "variables_semana_siguiente", "errores_de_prueba", "estimar"]
