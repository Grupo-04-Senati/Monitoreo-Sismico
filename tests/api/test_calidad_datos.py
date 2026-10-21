"""Pruebas de la limpieza, el informe de calidad y la partición (sin base de datos).

    pytest tests/api -q
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.schemas.datasets import DatasetCreateIn
from app.services.calidad_datos import FilaEvento, Reglas, distancia_km, preparar

_T0 = datetime(2024, 1, 10, 12, 0, tzinfo=timezone.utc)
_PERIODO = (datetime(2024, 1, 1, tzinfo=timezone.utc), datetime(2024, 3, 31, 23, 59, tzinfo=timezone.utc))


def _fila(id_: str, minutos: float = 0, **kw) -> FilaEvento:
    base = dict(
        id=id_,
        occurred_at=_T0 + timedelta(minutes=minutos),
        latitude=-12.0,
        longitude=-77.0,
        depth_km=40.0,
        magnitude=4.6,
        magnitude_type="mb",
        review_status="observado",
        origin_hash=f"h-{id_}",
    )
    base.update(kw)
    return FilaEvento(**base)


def test_distancia_lima_arequipa_aproximada():
    assert 760 < distancia_km(-12.05, -77.04, -16.40, -71.54) < 780


def test_duplicado_exacto_se_quita_siempre():
    r = preparar([_fila("a"), _fila("b", origin_hash="h-a")], Reglas(), periodo=_PERIODO)
    assert [i for i, _ in r.filas] == ["a"]
    assert r.informe["eliminadas_por_regla"]["duplicados_exactos"] == 1


def test_posible_duplicado_se_informa_y_se_quita_solo_si_se_pide():
    filas = [_fila("a"), _fila("b", minutos=0.5, latitude=-12.1), _fila("c", minutos=0.5, latitude=-15.0)]
    conservado = preparar(filas, Reglas(), periodo=_PERIODO)
    assert conservado.informe["posibles_duplicados"]["detectados"] == 1
    assert len(conservado.filas) == 3
    assert any("posible" in a for a in conservado.informe["advertencias"])

    excluido = preparar(filas, Reglas(posibles_duplicados="excluir"), periodo=_PERIODO)
    assert [i for i, _ in excluido.filas] == ["a", "c"]  # "c" está a > 50 km


def test_reglas_en_orden_y_conteo_por_regla():
    filas = [
        _fila("ok"),
        _fila("auto", minutos=10, review_status="pendiente_validacion"),
        _fila("ml", minutos=20, magnitude_type="ML"),
        _fila("baja", minutos=30, magnitude=3.9),
        _fila("sinprof", minutos=40, depth_km=None),
    ]
    reglas = Reglas(
        solo_revisados=True, tipos_magnitud=["mb", "Mw"], magnitud_minima=4.5, sin_profundidad="excluir"
    )
    r = preparar(filas, reglas, periodo=_PERIODO)
    assert [i for i, _ in r.filas] == ["ok"]
    assert r.informe["eliminadas_por_regla"] == {
        "duplicados_exactos": 0,
        "no_revisados": 1,
        "tipo_de_magnitud": 1,
        "bajo_magnitud_minima": 1,
        "sin_profundidad": 1,
    }
    assert r.informe["filas_origen"] == 5 and r.informe["filas_finales"] == 1


def test_imputacion_por_mediana_se_registra_con_su_valor():
    filas = [_fila("a", depth_km=10.0), _fila("b", 10, depth_km=30.0), _fila("c", 20, depth_km=None)]
    r = preparar(filas, Reglas(sin_profundidad="imputar_mediana"), periodo=_PERIODO)
    assert r.informe["imputacion"] == {
        "metodo": "mediana",
        "campo": "depth_km",
        "valor": 20.0,
        "filas_imputadas": 1,
    }
    assert len(r.filas) == 3
    assert r.informe["nulos_por_campo"]["depth_km"] == 1


def test_particion_temporal_y_advertencia_de_prueba_pequenia():
    filas = [_fila(f"e{i}", minutos=i * 60 * 24) for i in range(40)]  # un evento por día
    corte = _T0 + timedelta(days=35)
    r = preparar(filas, Reglas(), periodo=_PERIODO, fecha_corte=corte)
    splits = dict(r.filas)
    assert splits["e0"] == "entrenamiento" and splits["e39"] == "prueba"
    assert r.informe["particion"]["entrenamiento"] == 35
    assert r.informe["particion"]["prueba"] == 5
    assert any("prueba pequeña" in a for a in r.informe["advertencias"])


def test_advertencias_de_mezcla_de_magnitudes_region_vacia_y_tamanio():
    r = preparar([_fila("a"), _fila("b", 10, magnitude_type="Mw")], Reglas(), periodo=_PERIODO)
    texto = " ".join(r.informe["advertencias"])
    assert "Mezcla de tipos de magnitud (Mw, mb)" in texto
    assert "región está vacía" in texto
    assert "Dataset pequeño" in texto


def test_cobertura_mensual_detecta_meses_sin_eventos():
    r = preparar([_fila("a")], Reglas(), periodo=_PERIODO)
    assert r.informe["cobertura_temporal"]["meses"] == 3
    assert r.informe["cobertura_temporal"]["meses_sin_eventos"] == ["2024-02", "2024-03"]


@pytest.mark.parametrize(
    "cambios",
    [
        {"desde": "2024-05-01", "hasta": "2024-04-01"},
        {"fecha_corte": "2023-12-01"},
        {"variables": ["magnitude", "magnitude"]},
        {"variable_objetivo": "magnitude"},
        {"variables": ["no_existe"]},
    ],
)
def test_validacion_de_la_solicitud(cambios):
    base = {"name": "prueba", "desde": "2024-01-01", "hasta": "2024-03-31", "variables": ["magnitude"]}
    base.update(cambios)
    with pytest.raises(ValueError):
        DatasetCreateIn(**base)
