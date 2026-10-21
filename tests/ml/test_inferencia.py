"""Pruebas de la inferencia del conteo semanal (sin base de datos).

    pytest tests/ml -q
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "services"))

from ml.inference.conteo_semanal import (  # noqa: E402
    SEMANAS_NECESARIAS,
    ErrorEstimacion,
    errores_de_prueba,
    estimar,
    variables_semana_siguiente,
)


class _Constante:
    """Modelo de prueba que siempre estima el mismo valor."""

    def __init__(self, valor: float) -> None:
        self.valor = valor
        self.recibido = None

    def predict(self, x):  # noqa: ANN001
        self.recibido = x
        return [self.valor]


def test_variables_usan_las_semanas_anteriores():
    conteos = list(range(1, 13))  # semanas 1..12; la última es la anterior a la estimada
    assert variables_semana_siguiente(conteos) == [12.0, 11.0, 9.0, sum(range(1, 13)) / 12]


def test_faltan_semanas_previas():
    with pytest.raises(ErrorEstimacion, match=str(SEMANAS_NECESARIAS)):
        variables_semana_siguiente([1, 2, 3])


def test_errores_de_prueba_y_minimo():
    serie = [{"real": r, "regresion_poisson": 2.0} for r in range(12)]
    assert errores_de_prueba(serie, "regresion_poisson")[:3] == [-2.0, -1.0, 0.0]
    with pytest.raises(ErrorEstimacion):
        errores_de_prueba(serie[:5], "regresion_poisson")


def test_intervalo_empirico_y_nunca_negativo():
    errores = [float(e) for e in range(-10, 11)]  # cuantiles 5 % y 95 %: -9 y 9
    r = estimar(_Constante(3.0), [2] * 12, errores, "regresion_poisson")
    assert r["valor"] == 3.0
    assert r["inferior"] == 0.0  # 3 - 9 < 0 → se recorta en 0
    assert r["superior"] == 12.0
    assert r["nivel"] == 0.9 and r["metodo"].startswith("cuantiles 5–95 %")
    assert set(r["variables"]) == {
        "conteo_semana_menos_1", "conteo_semana_menos_2", "conteo_semana_menos_4", "media_ultimas_12_semanas",
    }


def test_regresion_lineal_no_estima_conteos_negativos():
    r = estimar(_Constante(-1.5), [0] * 12, [0.0] * 20, "regresion_lineal")
    assert r["valor"] == 0.0 and r["inferior"] == 0.0
