"""Regresión del conteo semanal de sismos del dataset (decisión D2).

Se comparan cuatro modelos en la partición de **prueba** (semanas desde la fecha
de corte del dataset; la semana que cruza el corte no se usa):

- `referencia_media`: la media semanal del entrenamiento.
- `referencia_semana_anterior`: el conteo de la semana anterior (persistencia).
- `regresion_lineal`: lineal sobre rezagos y media móvil.
- `regresion_poisson`: Poisson (adecuada para conteos) con las mismas variables.

Un modelo solo aporta si mejora a **ambas** referencias. Si ninguno lo hace, se
informa así: es un resultado válido, no un error.
"""

from __future__ import annotations

import warnings
from datetime import datetime, timedelta

import numpy as np
from sklearn.linear_model import LinearRegression, PoissonRegressor

from ml.evaluation.metricas import mejora, regresion
from ml.features.conteo_semanal import NOMBRES, REZAGOS, VENTANA_MEDIA, conteos_semanales, matriz
from ml.training.base import ErrorEntrenamiento, Resultado

TAREA = "conteo_semanal"
REFERENCIAS = ("referencia_media", "referencia_semana_anterior")
MIN_SEMANAS_ENTRENAMIENTO = 52
MIN_SEMANAS_PRUEBA = 12
#: Por debajo de esta mejora frente a la media, se advierte que es marginal.
MEJORA_MARGINAL = 0.05

LIMITACIONES = [
    "Estima cuántos sismos del dataset habrá en una semana a partir de las semanas anteriores; "
    "no predice dónde, cuándo ni de qué magnitud será un sismo.",
    "Las secuencias de réplicas tras un gran terremoto disparan los conteos y dominan el error.",
    "Cuenta los eventos de todo el dataset: no distingue zonas (la fuente no entrega el departamento).",
    "Es una estimación experimental: no es una alerta ni sustituye a IGP o INDECI.",
]


def entrenar(
    fechas: list[datetime],
    *,
    inicio: datetime,
    fin: datetime,
    fecha_corte: datetime | None,
    semilla: int = 42,
) -> Resultado:
    if fecha_corte is None:
        raise ErrorEntrenamiento("El dataset no tiene fecha de corte: hace falta una partición temporal.")
    np.random.seed(semilla)

    semanas, conteos = conteos_semanales(fechas, inicio, fin)
    filas, objetivo, desde = matriz(conteos)
    semanas_filas = semanas[desde:]
    entrenamiento = [i for i, s in enumerate(semanas_filas) if s + timedelta(days=7) <= fecha_corte]
    prueba = [i for i, s in enumerate(semanas_filas) if s >= fecha_corte]
    if len(entrenamiento) < MIN_SEMANAS_ENTRENAMIENTO:
        raise ErrorEntrenamiento(
            f"Solo hay {len(entrenamiento)} semanas de entrenamiento (mínimo {MIN_SEMANAS_ENTRENAMIENTO})."
        )
    if len(prueba) < MIN_SEMANAS_PRUEBA:
        raise ErrorEntrenamiento(f"Solo hay {len(prueba)} semanas de prueba (mínimo {MIN_SEMANAS_PRUEBA}).")

    X = np.array(filas, dtype=float)
    y = np.array(objetivo, dtype=float)
    X_tr, y_tr, X_te, y_te = X[entrenamiento], y[entrenamiento], X[prueba], y[prueba]

    lineal = LinearRegression().fit(X_tr, y_tr)
    with warnings.catch_warnings():
        # scipy reciente avisa de una opción interna obsoleta de scikit-learn; no afecta al ajuste.
        warnings.simplefilter("ignore", category=Warning)
        poisson = PoissonRegressor(alpha=1e-4, max_iter=1000).fit(X_tr, y_tr)
    estimados = {
        "referencia_media": np.full(len(y_te), y_tr.mean()),
        "referencia_semana_anterior": X_te[:, 0],
        # Un conteo no puede ser negativo.
        "regresion_lineal": np.clip(lineal.predict(X_te), 0, None),
        "regresion_poisson": poisson.predict(X_te),
    }
    reales = y_te.tolist()
    metricas = {m: regresion(reales, e.tolist()) for m, e in estimados.items()}
    mejor = min(metricas, key=lambda m: metricas[m]["mae"])
    tabla_mejora = {
        m: {ref: mejora(metricas[m]["mae"], metricas[ref]["mae"]) for ref in REFERENCIAS}
        for m in metricas
        if m not in REFERENCIAS
    }

    advertencias: list[str] = []
    varianza, media = float(y_tr.var()), float(y_tr.mean())
    if media and varianza > 2 * media:
        advertencias.append(
            f"Conteos muy dispersos en entrenamiento (varianza {varianza:.1f} frente a media {media:.2f}): "
            "típico de secuencias de réplicas; el MAE es más fiable que el RMSE."
        )
    if mejor in REFERENCIAS:
        advertencias.append(
            f"Ningún modelo supera a las referencias: la mejor estimación es «{mejor}». Se informa tal cual."
        )
    else:
        frente_media = tabla_mejora[mejor]["referencia_media"]
        if frente_media is not None and frente_media < MEJORA_MARGINAL:
            advertencias.append(
                f"«{mejor}» mejora a la media histórica solo un {frente_media:.1%} en MAE: "
                "es una mejora marginal, no una capacidad de pronóstico."
            )

    serie = [
        {
            "semana": semanas_filas[i].date().isoformat(),
            "real": int(y[i]),
            **{m: round(float(estimados[m][k]), 2) for m in estimados},
        }
        for k, i in enumerate(prueba)
    ]
    return Resultado(
        tarea=TAREA,
        mejor=mejor,
        metricas=metricas,
        mejora=tabla_mejora,
        variables=list(NOMBRES),
        objetivo="conteo_semanal",
        validacion={
            "tipo": "particion_temporal",
            "fecha_corte": fecha_corte.isoformat(),
            "semanas_entrenamiento": len(entrenamiento),
            "semanas_prueba": len(prueba),
            "primera_semana_entrenamiento": semanas_filas[entrenamiento[0]].date().isoformat(),
            "primera_semana_prueba": semanas_filas[prueba[0]].date().isoformat(),
            "rezagos": list(REZAGOS),
            "ventana_media": VENTANA_MEDIA,
        },
        serie_prueba=serie,
        coeficientes={
            "regresion_lineal": {
                "intercepto": round(float(lineal.intercept_), 4),
                **{n: round(float(c), 4) for n, c in zip(NOMBRES, lineal.coef_)},
            },
            "regresion_poisson": {
                "intercepto": round(float(poisson.intercept_), 4),
                **{n: round(float(c), 4) for n, c in zip(NOMBRES, poisson.coef_)},
            },
        },
        advertencias=advertencias,
        limitaciones=list(LIMITACIONES),
        modelos={"regresion_lineal": lineal, "regresion_poisson": poisson},
    )


__all__ = ["TAREA", "entrenar"]
