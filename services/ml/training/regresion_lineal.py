"""Regresión lineal didáctica sobre los eventos del dataset (PDF §10).

Ejercicio para estudiar asociaciones numéricas entre las variables de cada
evento (p. ej. magnitud frente a profundidad y ubicación). Usa las variables y la
variable objetivo que declara el dataset, su partición temporal y su imputación.
Se compara con la referencia de la media del entrenamiento.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import numpy as np
from sklearn.linear_model import LinearRegression

from ml.evaluation.metricas import mejora, regresion
from ml.training.base import ErrorEntrenamiento, Resultado

TAREA = "regresion_lineal"
NUMERICAS = ("occurred_at", "latitude", "longitude", "depth_km", "magnitude")
MIN_FILAS_ENTRENAMIENTO = 30
MIN_FILAS_PRUEBA = 10

LIMITACIONES = [
    "Ejercicio didáctico: describe asociaciones lineales entre variables de eventos ya ocurridos.",
    "Una asociación no implica causalidad ni permite anticipar terremotos.",
    "Es una estimación experimental: no es una alerta ni sustituye a IGP o INDECI.",
]


def _anio_decimal(momento: datetime) -> float:
    m = momento.astimezone(timezone.utc)
    inicio = datetime(m.year, 1, 1, tzinfo=timezone.utc)
    fin = datetime(m.year + 1, 1, 1, tzinfo=timezone.utc)
    return m.year + (m - inicio).total_seconds() / (fin - inicio).total_seconds()


def _valor(fila: dict[str, Any], columna: str) -> float | None:
    v = fila.get(columna)
    if v is None:
        return None
    return _anio_decimal(v) if columna == "occurred_at" else float(v)


def entrenar(
    filas: list[dict[str, Any]],
    *,
    variables: list[str],
    objetivo: str | None,
    semilla: int = 42,
) -> Resultado:
    """`filas`: eventos del dataset con `split` y la imputación ya aplicada."""
    if objetivo is None:
        raise ErrorEntrenamiento("El dataset no declara variable objetivo.")
    if objetivo not in NUMERICAS:
        raise ErrorEntrenamiento(f"La variable objetivo «{objetivo}» no es numérica.")
    np.random.seed(semilla)

    advertencias: list[str] = []
    usadas = [v for v in variables if v in NUMERICAS]
    descartadas = [v for v in variables if v not in NUMERICAS]
    if descartadas:
        advertencias.append(f"Variables no numéricas no usadas: {', '.join(descartadas)}.")
    if not usadas:
        raise ErrorEntrenamiento("El dataset no tiene variables numéricas para la regresión.")

    datos = {"entrenamiento": ([], []), "prueba": ([], [])}
    incompletas = 0
    for f in filas:
        if f.get("split") not in datos:
            continue
        x = [_valor(f, v) for v in usadas]
        y = _valor(f, objetivo)
        if y is None or any(v is None for v in x):
            incompletas += 1
            continue
        datos[f["split"]][0].append(x)
        datos[f["split"]][1].append(y)
    if incompletas:
        advertencias.append(f"{incompletas} evento(s) con valores vacíos no se usaron.")

    X_tr, y_tr = (np.array(a, dtype=float) for a in datos["entrenamiento"])
    X_te, y_te = (np.array(a, dtype=float) for a in datos["prueba"])
    if len(y_tr) < MIN_FILAS_ENTRENAMIENTO:
        raise ErrorEntrenamiento(
            f"Solo hay {len(y_tr)} eventos de entrenamiento (mínimo {MIN_FILAS_ENTRENAMIENTO}); "
            "¿el dataset tiene fecha de corte?"
        )
    if len(y_te) < MIN_FILAS_PRUEBA:
        raise ErrorEntrenamiento(f"Solo hay {len(y_te)} eventos de prueba (mínimo {MIN_FILAS_PRUEBA}).")

    modelo = LinearRegression().fit(X_tr, y_tr)
    estimados = {
        "referencia_media": np.full(len(y_te), y_tr.mean()),
        "regresion_lineal": modelo.predict(X_te),
    }
    reales = y_te.tolist()
    metricas = {m: regresion(reales, e.tolist()) for m, e in estimados.items()}
    mejor = min(metricas, key=lambda m: metricas[m]["mae"])
    r2 = metricas["regresion_lineal"]["r2"]
    if r2 is not None and r2 < 0.1:
        advertencias.append(f"R² en prueba de {r2}: las variables explican muy poco de «{objetivo}».")
    if mejor == "referencia_media":
        advertencias.append("La regresión no supera a la media del entrenamiento. Se informa tal cual.")

    paso = max(1, len(reales) // 300)  # la serie se recorta para no inflar la respuesta
    serie = [
        {"real": round(reales[i], 3), "regresion_lineal": round(float(estimados["regresion_lineal"][i]), 3)}
        for i in range(0, len(reales), paso)
    ]
    return Resultado(
        tarea=TAREA,
        mejor=mejor,
        metricas=metricas,
        mejora={"regresion_lineal": {"referencia_media": mejora(metricas["regresion_lineal"]["mae"], metricas["referencia_media"]["mae"])}},
        variables=usadas,
        objetivo=objetivo,
        validacion={
            "tipo": "particion_temporal",
            "filas_entrenamiento": int(len(y_tr)),
            "filas_prueba": int(len(y_te)),
            "occurred_at_como": "año decimal" if "occurred_at" in usadas else None,
        },
        serie_prueba=serie,
        coeficientes={
            "regresion_lineal": {
                "intercepto": round(float(modelo.intercept_), 6),
                **{v: round(float(c), 6) for v, c in zip(usadas, modelo.coef_)},
            }
        },
        advertencias=advertencias,
        limitaciones=list(LIMITACIONES),
        modelos={"regresion_lineal": modelo},
    )


__all__ = ["TAREA", "NUMERICAS", "entrenar"]
