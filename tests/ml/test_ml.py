"""Pruebas del paquete de ML (sin base de datos): variables, métricas y entrenamiento.

Se usan series sintéticas con resultado conocido.

    pytest tests/ml -q
"""

from __future__ import annotations

import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "services"))

from ml.evaluation.metricas import mejora, regresion  # noqa: E402
from ml.features.conteo_semanal import VENTANA_MEDIA, conteos_semanales, inicio_semana, matriz  # noqa: E402
from ml.training import conteo_semanal, regresion_lineal  # noqa: E402
from ml.training.base import ErrorEntrenamiento  # noqa: E402

UTC = timezone.utc
LUNES = datetime(2020, 1, 6, tzinfo=UTC)  # un lunes


# ── Variables ───────────────────────────────────────────────────────────────


def test_inicio_de_semana_es_lunes_utc():
    assert inicio_semana(datetime(2020, 1, 9, 15, 30, tzinfo=UTC)) == LUNES


def test_conteos_incluyen_semanas_vacias_y_descartan_la_parcial_inicial():
    fechas = [LUNES + timedelta(days=1), LUNES + timedelta(days=2), LUNES + timedelta(days=15)]
    # Fin como en un dataset real: el último día incluido, hasta el último microsegundo.
    semanas, conteos = conteos_semanales(fechas, LUNES - timedelta(days=3), LUNES + timedelta(days=21) - timedelta(microseconds=1))
    assert semanas[0] == LUNES  # la semana parcial anterior no cuenta
    assert conteos == [2, 0, 1]


def test_la_matriz_solo_usa_semanas_anteriores():
    conteos = list(range(20))
    filas, objetivo, desde = matriz(conteos)
    assert desde == VENTANA_MEDIA
    # Primera fila: estima la semana 12 con las semanas 11, 10, 8 y la media de 0..11.
    assert objetivo[0] == 12
    assert filas[0] == [11.0, 10.0, 8.0, sum(range(12)) / 12]


# ── Métricas ────────────────────────────────────────────────────────────────


def test_metricas_de_regresion_con_valores_conocidos():
    m = regresion([1, 2, 3, 4], [1, 2, 3, 6])
    assert m == {"mae": 0.5, "rmse": 1.0, "r2": 0.2, "n": 4}
    assert regresion([2, 2], [2, 3])["r2"] is None  # sin varianza no hay R²
    assert mejora(1.0, 2.0) == 0.5 and mejora(None, 2.0) is None


# ── Conteo semanal ──────────────────────────────────────────────────────────


def _poisson(rng: random.Random, tasa: float) -> int:
    n, limite, p = 0, pow(2.718281828459045, -tasa), 1.0
    while True:
        p *= rng.random()
        if p < limite:
            return n
        n += 1


def _serie_con_memoria(semanas: int, semilla: int = 7) -> list[datetime]:
    """Rachas de actividad alta y baja (26 semanas cada una) con ruido de Poisson.

    La media de las últimas semanas sabe en qué racha se está; la media global y
    la semana anterior (ruidosa) no: hay señal que un modelo puede aprender.
    """
    rng = random.Random(semilla)
    fechas = []
    for s in range(semanas):
        tasa = 8.0 if (s // 26) % 2 else 1.0
        inicio = LUNES + timedelta(weeks=s)
        fechas += [inicio + timedelta(hours=rng.uniform(0, 167)) for _ in range(_poisson(rng, tasa))]
    return fechas


def test_conteo_semanal_con_senal_supera_a_la_media():
    fechas = _serie_con_memoria(300)
    r = conteo_semanal.entrenar(
        fechas,
        inicio=LUNES,
        fin=LUNES + timedelta(weeks=300) - timedelta(microseconds=1),
        fecha_corte=LUNES + timedelta(weeks=240),
    )
    assert set(r.metricas) == {"referencia_media", "referencia_semana_anterior", "regresion_lineal", "regresion_poisson"}
    assert r.mejor in {"regresion_lineal", "regresion_poisson"}
    # Aprende la señal (mucho mejor que la media) y además gana a la persistencia.
    assert r.mejora[r.mejor]["referencia_media"] > 0.3
    assert r.mejora[r.mejor]["referencia_semana_anterior"] > 0
    assert r.validacion["semanas_prueba"] == 60
    assert len(r.serie_prueba) == 60 and {"semana", "real", "regresion_poisson"} <= set(r.serie_prueba[0])
    assert any("no predice" in lim for lim in r.limitaciones)


def test_conteo_semanal_sin_senal_lo_dice():
    rng = random.Random(3)
    fechas = [LUNES + timedelta(hours=rng.uniform(0, 300 * 168)) for _ in range(900)]  # tasa constante
    r = conteo_semanal.entrenar(
        fechas, inicio=LUNES, fin=LUNES + timedelta(weeks=300) - timedelta(microseconds=1), fecha_corte=LUNES + timedelta(weeks=240)
    )
    texto = " ".join(r.advertencias)
    assert "referencias" in texto or "marginal" in texto


@pytest.mark.parametrize(
    ("corte", "mensaje"),
    [(None, "fecha de corte"), (LUNES + timedelta(weeks=30), "semanas de entrenamiento"), (LUNES + timedelta(weeks=295), "semanas de prueba")],
)
def test_conteo_semanal_rechaza_particiones_insuficientes(corte, mensaje):
    with pytest.raises(ErrorEntrenamiento, match=mensaje):
        conteo_semanal.entrenar(
            _serie_con_memoria(300), inicio=LUNES, fin=LUNES + timedelta(weeks=300) - timedelta(microseconds=1), fecha_corte=corte
        )


# ── Regresión lineal didáctica ──────────────────────────────────────────────


def _filas_lineales(n: int = 200) -> list[dict]:
    rng = random.Random(11)
    filas = []
    for i in range(n):
        prof = rng.uniform(5, 300)
        filas.append(
            {
                "split": "entrenamiento" if i < 150 else "prueba",
                "occurred_at": LUNES + timedelta(days=i),
                "latitude": rng.uniform(-18, -1),
                "longitude": rng.uniform(-81, -69),
                "depth_km": prof,
                "magnitude": 4.0 + 0.01 * prof,  # relación exacta conocida
                "magnitude_type": "mb",
            }
        )
    return filas


def test_regresion_lineal_recupera_una_relacion_exacta():
    r = regresion_lineal.entrenar(_filas_lineales(), variables=["depth_km", "magnitude_type"], objetivo="magnitude")
    assert r.mejor == "regresion_lineal"
    assert r.metricas["regresion_lineal"]["r2"] == pytest.approx(1.0, abs=1e-6)
    assert r.coeficientes["regresion_lineal"]["depth_km"] == pytest.approx(0.01, abs=1e-6)
    assert any("no numéricas" in a for a in r.advertencias)  # magnitude_type se descarta
    assert r.validacion["filas_entrenamiento"] == 150 and r.validacion["filas_prueba"] == 50


def test_regresion_lineal_descarta_filas_incompletas_y_valida_objetivo():
    filas = _filas_lineales()
    filas[0]["depth_km"] = None
    r = regresion_lineal.entrenar(filas, variables=["depth_km"], objetivo="magnitude")
    assert any("1 evento(s)" in a for a in r.advertencias)
    with pytest.raises(ErrorEntrenamiento, match="no es numérica"):
        regresion_lineal.entrenar(filas, variables=["depth_km"], objetivo="magnitude_type")
    with pytest.raises(ErrorEntrenamiento, match="objetivo"):
        regresion_lineal.entrenar(filas, variables=["depth_km"], objetivo=None)
