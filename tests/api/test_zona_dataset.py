"""Sector geográfico de un dataset (D32), sin base de datos.

    pytest tests/api -q
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.schemas.datasets import ZonaDatasetIn
from app.services import zona_dataset

AREQUIPA = SimpleNamespace(latitude=-16.4, longitude=-71.5, region="Arequipa")
CAMANA = SimpleNamespace(latitude=-16.62, longitude=-72.71, region="Arequipa")  # ~130 km de Arequipa
LIMA = SimpleNamespace(latitude=-12.05, longitude=-77.04, region="Lima")
ECUADOR = SimpleNamespace(latitude=-1.5, longitude=-80.5, region=None)


def test_sin_zona_entra_todo():
    filas, fuera = zona_dataset.filtrar([AREQUIPA, LIMA, ECUADOR], None)
    assert len(filas) == 3 and fuera == 0
    assert zona_dataset.describir({"tipo": "todo"}).startswith("Toda la cobertura")


def test_por_departamentos_usa_la_region_asignada():
    zona = {"tipo": "departamentos", "departamentos": ["Arequipa"]}
    filas, fuera = zona_dataset.filtrar([AREQUIPA, CAMANA, LIMA, ECUADOR], zona)
    assert filas == [AREQUIPA, CAMANA] and fuera == 2
    assert zona_dataset.describir(zona) == "Departamentos: Arequipa"


def test_por_radio_usa_la_distancia_al_epicentro():
    zona = {"tipo": "circulo", "nombre": "Mina Arequipa", "lat": -16.4, "lon": -71.5, "radio_km": 100}
    filas, fuera = zona_dataset.filtrar([AREQUIPA, CAMANA, LIMA], zona)
    assert filas == [AREQUIPA] and fuera == 2
    zona["radio_km"] = 150
    assert len(zona_dataset.filtrar([AREQUIPA, CAMANA, LIMA], zona)[0]) == 2
    assert zona_dataset.describir(zona) == "Mina Arequipa: 150 km a la redonda"
    assert 125 < zona_dataset.distancia_km(-16.4, -71.5, -16.62, -72.71) < 135


def test_la_zona_debe_estar_completa():
    with pytest.raises(ValidationError):
        ZonaDatasetIn(tipo="departamentos", departamentos=[])
    with pytest.raises(ValidationError):
        ZonaDatasetIn(tipo="circulo", lat=-16.4, lon=-71.5)
    with pytest.raises(ValidationError):
        ZonaDatasetIn(tipo="departamentos", departamentos=["Atlántida"])
    assert ZonaDatasetIn().tipo == "todo"
