"""Pruebas de la evaluación de reglas de aviso y de su validación (sin base de datos).

    pytest tests/api -q
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.schemas.alertas import ReglaIn
from app.services.alertas_reglas import EventoAlerta, es_reciente, evaluar, marcadores, render

T = datetime(2026, 10, 11, 18, 42, tzinfo=timezone.utc)
AREQUIPA = {"tipo": "circulo", "nombre": "Mina Arequipa", "lat": -16.4, "lon": -71.5, "radio_km": 150}


def _evento(**kw) -> EventoAlerta:
    base = dict(
        id="e1", occurred_at=T, latitude=-17.3, longitude=-72.4, depth_km=40.0, magnitude=5.2,
        magnitude_type="mb", review_status="observado", locality="20 km SW of Camaná, Peru",
        source_url="https://earthquake.usgs.gov/earthquakes/eventpage/x",
    )
    base.update(kw)
    return EventoAlerta(**base)


@pytest.mark.parametrize(
    ("condicion", "evento", "esperado"),
    [
        ({"magnitud_minima": 5.0}, {}, True),
        ({"magnitud_minima": 5.5}, {}, False),
        ({"magnitud_minima": 4.0, "profundidad_max_km": 30}, {}, False),
        ({"magnitud_minima": 4.0, "profundidad_min_km": 30, "profundidad_max_km": 70}, {}, True),
        ({"magnitud_minima": 4.0, "profundidad_max_km": 70}, {"depth_km": None}, False),
        ({"magnitud_minima": 4.0, "solo_revisados": True}, {"review_status": "pendiente_validacion"}, False),
        ({"magnitud_minima": 4.0, "tipos_magnitud": ["Mw"]}, {}, False),
        ({"magnitud_minima": 4.0, "tipos_magnitud": ["Mw", "mb"]}, {}, True),
        ({"magnitud_minima": 4.0}, {"magnitude": None}, False),
    ],
)
def test_condiciones(condicion, evento, esperado):
    assert evaluar(condicion, {"tipo": "todo"}, _evento(**evento)) == (esperado, None)


def test_zona_circular_dentro_y_fuera():
    dentro, d = evaluar({"magnitud_minima": 4.0}, AREQUIPA, _evento())
    assert dentro and 120 < d < 140
    fuera, d2 = evaluar({"magnitud_minima": 4.0}, AREQUIPA, _evento(latitude=-12.0, longitude=-77.0))
    assert not fuera and d2 > 700


def test_antiguedad_maxima():
    e = _evento()
    assert es_reciente(e, T + timedelta(hours=23), 24)
    assert not es_reciente(e, T + timedelta(hours=25), 24)


def test_plantilla_con_marcador_desconocido_no_se_inventa():
    valores = marcadores(_evento(), 130.8, AREQUIPA, "Regla mina")
    texto = render("M{magnitud} {tipo} a {distancia} de {zona} ({regla}) {inexistente}", valores)
    assert texto == "M5.2 mb a 131 km de Mina Arequipa (Regla mina) {inexistente}"
    assert render("llave sin cerrar {", valores) == "llave sin cerrar {"
    assert "13:42 (UTC-5)" in valores["fecha"]


@pytest.mark.parametrize(
    ("cambios", "mensaje"),
    [
        ({"canales": ["email"]}, "destinatario"),
        ({"canales": ["app", "app"]}, "repetirse"),
        ({"zona": {"tipo": "circulo", "lat": -16.4}}, "latitud, longitud y radio"),
        ({"condicion": {"magnitud_minima": 4, "profundidad_min_km": 80, "profundidad_max_km": 10}}, "profundidad"),
        ({"destinatarios": ["no-es-correo"], "canales": ["email"]}, "email"),
    ],
)
def test_validacion_de_reglas(cambios, mensaje):
    base = {"name": "regla", "condicion": {"magnitud_minima": 4.5}}
    base.update(cambios)
    with pytest.raises(ValueError, match=mensaje):
        ReglaIn(**base)


def test_valores_por_defecto_seguros():
    r = ReglaIn(name="regla", condicion={"magnitud_minima": 4.5})
    assert r.canales == ["app"] and r.requiere_aprobacion and r.antiguedad_max_horas == 24
    assert "no es una alerta oficial" in r.plantilla_mensaje
