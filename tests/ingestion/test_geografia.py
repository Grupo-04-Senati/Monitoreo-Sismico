"""Departamento de un epicentro (decisión D24): dentro de un polígono, o el más cercano
si la fuente lo sitúa en el Perú; nunca un departamento para sismos de otro país."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services"))

from ingestion.geografia import DISTANCIA_MAX_KM, NOMBRES, departamento, departamentos, geojson_con_nombres  # noqa: E402


@pytest.mark.parametrize(
    ("lat", "lon", "esperado"),
    [
        (-12.046, -77.043, "Lima"),
        (-12.056, -77.135, "Callao"),
        (-16.399, -71.537, "Arequipa"),
        (-13.532, -71.967, "Cusco"),
        (-3.749, -73.253, "Loreto"),
        (-9.930, -76.242, "Huánuco"),
        (-6.486, -76.365, "San Martín"),
    ],
)
def test_epicentro_dentro_de_un_departamento(lat, lon, esperado):
    assert departamento(lat, lon) == esperado


def test_en_el_mar_frente_a_la_costa_peruana_se_asigna_el_mas_cercano():
    assert departamento(-17.0, -73.0, "60 km SW of Camaná, Peru") == "Arequipa"
    assert departamento(-14.6, -76.6, "45 km W of Paracas, Peru") == "Ica"
    assert departamento(-17.0, -73.0, None) is None  # sin texto de la fuente no se supone nada


def test_otro_pais_o_demasiado_lejos_queda_sin_region():
    assert departamento(-16.5, -68.15, "10 km N of La Paz, Bolivia") is None
    assert departamento(-2.2, -79.9, "Guayaquil, Ecuador") is None
    assert departamento(-10.0, -85.0, "off the coast of central Peru") is None  # > 200 km
    assert departamento(None, -77.0) is None


def test_los_25_departamentos_tienen_el_nombre_de_la_plataforma():
    nombres = {d.nombre for d in departamentos()}
    assert len(nombres) == 25 and nombres == set(NOMBRES.values())
    assert {f["properties"]["nombre"] for f in geojson_con_nombres()["features"]} == nombres
    assert DISTANCIA_MAX_KM == 200.0
