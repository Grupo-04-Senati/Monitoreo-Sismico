"""Servicio de Machine Learning (PDF §5 y §10): features, entrenamiento y evaluación.

Lógica pura (sin base de datos); la API la usa a través de `app.services.ml_bridge`.
"""



import os

# joblib intenta contar los núcleos físicos con `wmic`, que ya no existe en
# Windows reciente, y avisa en cada arranque. El entrenamiento no usa paralelismo.
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")
