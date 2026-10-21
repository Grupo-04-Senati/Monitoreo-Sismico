"""Limpieza, informe de calidad y partición temporal de un dataset (PDF §6.5).

Funciones **puras** (sin base de datos): reciben las filas del catálogo y las
reglas, y devuelven qué eventos entran, en qué partición y el informe. Así la
misma lógica se prueba sin PostgreSQL y el resultado es reproducible.

Orden de las reglas (cada una cuenta cuántas filas quita):
1. duplicados exactos (misma huella `origin_hash`): siempre se quitan;
2. posibles duplicados (mismo sismo reportado dos veces: < 60 s y < 50 km);
3. solo eventos revisados;
4. tipos de magnitud permitidos;
5. magnitud mínima (umbral de completitud del catálogo);
6. eventos sin profundidad (excluir, imputar con la mediana o conservar).
"""

from __future__ import annotations

import math
import statistics
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

#: Criterio de "posible duplicado".
VENTANA_DUPLICADO_SEG = 60
DISTANCIA_DUPLICADO_KM = 50.0

#: Umbrales de las advertencias.
MIN_FILAS = 100
MIN_FILAS_PRUEBA = 30
MIN_FRACCION_PRUEBA = 0.10

#: Campos cuyos nulos se informan.
CAMPOS_NULOS = ("depth_km", "magnitude", "magnitude_type", "region", "locality", "source_url")

ENTRENAMIENTO = "entrenamiento"
PRUEBA = "prueba"


@dataclass(frozen=True)
class FilaEvento:
    id: str
    occurred_at: datetime
    latitude: float
    longitude: float
    depth_km: float | None
    magnitude: float | None
    magnitude_type: str | None
    review_status: str
    origin_hash: str
    region: str | None = None
    locality: str | None = None
    source_url: str | None = None


@dataclass
class Reglas:
    magnitud_minima: float | None = None
    solo_revisados: bool = False
    tipos_magnitud: list[str] | None = None
    #: "excluir" | "imputar_mediana" | "conservar"
    sin_profundidad: str = "conservar"
    #: "excluir" | "conservar"
    posibles_duplicados: str = "conservar"


@dataclass
class Resultado:
    #: (id del evento, partición) en orden cronológico.
    filas: list[tuple[str, str | None]] = field(default_factory=list)
    informe: dict[str, Any] = field(default_factory=dict)


def distancia_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia de círculo máximo (haversine)."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _posibles_duplicados(filas: list[FilaEvento]) -> set[str]:
    """Ids de los reportes repetidos (se conserva el primero en el tiempo)."""
    repetidos: set[str] = set()
    for i, actual in enumerate(filas):
        if actual.id in repetidos:
            continue
        for siguiente in filas[i + 1:]:
            if (siguiente.occurred_at - actual.occurred_at).total_seconds() > VENTANA_DUPLICADO_SEG:
                break
            if siguiente.id not in repetidos and distancia_km(
                actual.latitude, actual.longitude, siguiente.latitude, siguiente.longitude
            ) < DISTANCIA_DUPLICADO_KM:
                repetidos.add(siguiente.id)
    return repetidos


def _meses(inicio: datetime, fin: datetime) -> list[str]:
    meses, y, m = [], inicio.year, inicio.month
    while (y, m) <= (fin.year, fin.month):
        meses.append(f"{y:04d}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return meses


def _rango(valores: list[float]) -> dict[str, float | None]:
    if not valores:
        return {"minimo": None, "maximo": None, "media": None, "mediana": None}
    return {
        "minimo": min(valores),
        "maximo": max(valores),
        "media": round(statistics.fmean(valores), 3),
        "mediana": statistics.median(valores),
    }


def preparar(
    filas: list[FilaEvento],
    reglas: Reglas,
    *,
    periodo: tuple[datetime, datetime],
    fecha_corte: datetime | None = None,
) -> Resultado:
    """Aplica las reglas y calcula el informe de calidad del dataset."""
    origen = sorted(filas, key=lambda f: (f.occurred_at, f.id))
    nulos = {c: sum(1 for f in origen if getattr(f, c) in (None, "")) for c in CAMPOS_NULOS}
    eliminadas: dict[str, int] = {}

    # 1. Duplicados exactos.
    vistos: set[str] = set()
    actuales: list[FilaEvento] = []
    for f in origen:
        if f.origin_hash in vistos:
            continue
        vistos.add(f.origin_hash)
        actuales.append(f)
    eliminadas["duplicados_exactos"] = len(origen) - len(actuales)

    # 2. Posibles duplicados (se informan siempre; se quitan si la regla lo pide).
    sospechosos = _posibles_duplicados(actuales)
    if reglas.posibles_duplicados == "excluir":
        actuales = [f for f in actuales if f.id not in sospechosos]
        eliminadas["posibles_duplicados"] = len(sospechosos)

    def _filtrar(nombre: str, condicion) -> None:  # noqa: ANN001
        nonlocal actuales
        antes = len(actuales)
        actuales = [f for f in actuales if condicion(f)]
        eliminadas[nombre] = antes - len(actuales)

    if reglas.solo_revisados:
        _filtrar("no_revisados", lambda f: f.review_status == "observado")
    if reglas.tipos_magnitud:
        permitidos = set(reglas.tipos_magnitud)
        _filtrar("tipo_de_magnitud", lambda f: f.magnitude_type in permitidos)
    if reglas.magnitud_minima is not None:
        _filtrar("bajo_magnitud_minima", lambda f: f.magnitude is not None and f.magnitude >= reglas.magnitud_minima)
    if reglas.sin_profundidad == "excluir":
        _filtrar("sin_profundidad", lambda f: f.depth_km is not None)

    # 6b. Imputación (se guarda el valor: quien cargue el dataset lo aplica igual).
    imputacion: dict[str, Any] = {"metodo": "ninguna"}
    if reglas.sin_profundidad == "imputar_mediana":
        con_prof = [f.depth_km for f in actuales if f.depth_km is not None]
        faltan = sum(1 for f in actuales if f.depth_km is None)
        imputacion = {
            "metodo": "mediana",
            "campo": "depth_km",
            "valor": statistics.median(con_prof) if con_prof else None,
            "filas_imputadas": faltan,
        }

    # Partición temporal: entrenamiento antes del corte, prueba desde el corte.
    def _split(f: FilaEvento) -> str | None:
        if fecha_corte is None:
            return None
        return ENTRENAMIENTO if f.occurred_at < fecha_corte else PRUEBA

    resultado_filas = [(f.id, _split(f)) for f in actuales]
    conteo_split = Counter(s for _, s in resultado_filas if s)

    meses = _meses(*periodo)
    con_eventos = {f.occurred_at.astimezone(timezone.utc).strftime("%Y-%m") for f in actuales}
    tipos = Counter(f.magnitude_type or "sin tipo" for f in actuales)

    advertencias: list[str] = []
    if len(actuales) < MIN_FILAS:
        advertencias.append(f"Dataset pequeño ({len(actuales)} filas < {MIN_FILAS}): las métricas serán inestables.")
    tipos_reales = [t for t in tipos if t != "sin tipo"]
    if len(tipos_reales) > 1:
        advertencias.append(
            f"Mezcla de tipos de magnitud ({', '.join(sorted(tipos_reales))}): no son directamente "
            "comparables; considere filtrar por tipo."
        )
    if origen and nulos["region"] == len(origen):
        advertencias.append("La región está vacía en todas las filas: la fuente no entrega el departamento.")
    if sospechosos and reglas.posibles_duplicados != "excluir":
        advertencias.append(f"{len(sospechosos)} posible(s) duplicado(s) conservado(s).")
    if fecha_corte is not None:
        prueba, total = conteo_split.get(PRUEBA, 0), len(actuales)
        if conteo_split.get(ENTRENAMIENTO, 0) == 0:
            advertencias.append("La partición de entrenamiento está vacía.")
        if prueba < MIN_FILAS_PRUEBA or (total and prueba / total < MIN_FRACCION_PRUEBA):
            advertencias.append(
                f"Partición de prueba pequeña ({prueba} filas): la evaluación será poco fiable."
            )

    informe = {
        "filas_origen": len(origen),
        "filas_finales": len(actuales),
        "eliminadas_por_regla": eliminadas,
        "posibles_duplicados": {
            "detectados": len(sospechosos),
            "criterio": f"< {VENTANA_DUPLICADO_SEG} s y < {DISTANCIA_DUPLICADO_KM:g} km",
        },
        "nulos_por_campo": nulos,
        "imputacion": imputacion,
        "distribucion": {
            "tipo_magnitud": dict(tipos),
            "estado_revision": dict(Counter(f.review_status for f in actuales)),
        },
        "magnitud": _rango([f.magnitude for f in actuales if f.magnitude is not None]),
        "profundidad_km": _rango([f.depth_km for f in actuales if f.depth_km is not None]),
        "cobertura_temporal": {
            "primer_evento": actuales[0].occurred_at.isoformat() if actuales else None,
            "ultimo_evento": actuales[-1].occurred_at.isoformat() if actuales else None,
            "meses": len(meses),
            "meses_sin_eventos": [m for m in meses if m not in con_eventos],
        },
        "particion": {
            "fecha_corte": fecha_corte.isoformat() if fecha_corte else None,
            ENTRENAMIENTO: conteo_split.get(ENTRENAMIENTO, 0),
            PRUEBA: conteo_split.get(PRUEBA, 0),
        },
        "advertencias": advertencias,
    }
    return Resultado(filas=resultado_filas, informe=informe)


__all__ = [
    "FilaEvento",
    "Reglas",
    "Resultado",
    "preparar",
    "distancia_km",
    "ENTRENAMIENTO",
    "PRUEBA",
]
