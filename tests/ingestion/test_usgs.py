"""Pruebas del conector y el normalizador del USGS (sin red ni base de datos).

Los `features` de prueba siguen el formato GeoJSON del servicio FDSN del USGS.
La red se sustituye reemplazando `_get_json`.

    pytest tests/ingestion -q
"""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "services"))

from ingestion.connectors.base import ConnectorError, RawRecord  # noqa: E402
from ingestion.connectors.pendiente import PendienteConnector  # noqa: E402
from ingestion.connectors.usgs import LIMITE_USGS, UsgsConnector  # noqa: E402
from ingestion.engine import run_sync  # noqa: E402
from ingestion.fuentes import crear_pipeline  # noqa: E402
from ingestion.normalizers.usgs import UsgsNormalizer, tipo_magnitud  # noqa: E402

_AHORA = datetime(2026, 10, 20, 12, 0, tzinfo=timezone.utc)


def _feature(
    id_: str = "us7000prueba",
    *,
    lon: float = -76.5,
    lat: float = -12.3,
    prof: float | None = 45.0,
    mag: float | None = 4.6,
    mag_type: str = "mww",
    status: str = "reviewed",
) -> dict:
    coords = [lon, lat] if prof is None else [lon, lat, prof]
    return {
        "type": "Feature",
        "id": id_,
        "properties": {
            "mag": mag,
            "magType": mag_type,
            "place": "35 km SW of Lima, Peru",
            "time": int(datetime(2026, 10, 1, 8, 30, tzinfo=timezone.utc).timestamp() * 1000),
            "status": status,
            "url": f"https://earthquake.usgs.gov/earthquakes/eventpage/{id_}",
            "type": "earthquake",
        },
        "geometry": {"type": "Point", "coordinates": coords},
    }


class _ConectorFijo(UsgsConnector):
    """UsgsConnector con la red sustituida por una respuesta fija."""

    def __init__(self, respuesta: dict, **kw) -> None:
        super().__init__(ahora=lambda: _AHORA, **kw)
        self.respuesta = respuesta
        self.urls: list[str] = []

    def _get_json(self, url: str) -> dict:
        self.urls.append(url)
        return self.respuesta


class _RepoMemoria:
    def __init__(self) -> None:
        self.ids: set[str] = set()

    async def upsert(self, event) -> bool:  # noqa: ANN001
        if event.external_id in self.ids:
            return False
        self.ids.add(event.external_id)
        return True


# ── Normalizador ────────────────────────────────────────────────────────────


def test_normaliza_un_evento_revisado():
    r = UsgsNormalizer().normalize(RawRecord("us7000prueba", _feature()))
    assert r.ok and r.event is not None
    e = r.event
    assert e.external_id == "us7000prueba"
    assert e.occurred_at == datetime(2026, 10, 1, 8, 30, tzinfo=timezone.utc)
    assert (e.latitude, e.longitude, e.depth_km) == (-12.3, -76.5, 45.0)
    assert (e.magnitude, e.magnitude_type) == (4.6, "Mw")
    assert e.review_status == "observado"
    assert e.locality == "35 km SW of Lima, Peru"
    assert e.source_url.endswith("/us7000prueba")
    assert e.region == "Lima"  # derivado de las coordenadas (35 km al SO de Lima, en el mar)
    assert len(e.origin_hash) == 64


def test_evento_automatico_queda_pendiente_de_validacion():
    r = UsgsNormalizer().normalize(RawRecord("x", _feature(status="automatic")))
    assert r.event is not None and r.event.review_status == "pendiente_validacion"


@pytest.mark.parametrize(
    ("entrada", "esperado"),
    [("mww", "Mw"), ("mwr", "Mw"), ("ml", "ML"), ("mb", "mb"), ("mb_lg", "mb"), ("md", "md"), (None, None)],
)
def test_tipo_de_magnitud(entrada, esperado):
    assert tipo_magnitud(entrada) == esperado


@pytest.mark.parametrize(
    ("feature", "motivo"),
    [
        (_feature(lat=-30.0), "latitud"),
        (_feature(lon=-60.0), "longitud"),
        (_feature(mag=None), "magnitud"),
        (_feature(prof=-1.2), "profundidad"),
    ],
)
def test_rechaza_valores_fuera_de_rango(feature, motivo):
    r = UsgsNormalizer().normalize(RawRecord("x", feature))
    assert not r.ok and motivo in (r.motivo or "")


def test_profundidad_ausente_se_acepta_como_vacia():
    r = UsgsNormalizer().normalize(RawRecord("x", _feature(prof=None)))
    assert r.event is not None and r.event.depth_km is None


# ── Conector ────────────────────────────────────────────────────────────────


def _params(url: str) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}


def test_primera_sincronizacion_pide_la_ventana_inicial():
    c = _ConectorFijo({"features": [_feature()]})
    registros = c.fetch(None)
    p = _params(c.urls[0])
    assert len(registros) == 1
    assert p["starttime"] == (_AHORA - timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%S")
    assert p["eventtype"] == "earthquake" and p["format"] == "geojson"
    assert (p["minlatitude"], p["maxlatitude"]) == ("-18.6", "0.5")


def test_sincronizacion_incremental_pide_lo_modificado_con_solape():
    """Sincronización normal: lo modificado desde la última (menos 6 h) en los últimos 60 días."""
    c = _ConectorFijo({"features": []})
    desde = datetime(2026, 10, 19, 10, 0, tzinfo=timezone.utc)
    c.fetch(desde)
    p = _params(c.urls[0])
    assert len(c.urls) == 1 and p["updatedafter"] == "2026-10-19T04:00:00"
    assert p["starttime"] == (_AHORA - timedelta(days=60)).strftime("%Y-%m-%dT%H:%M:%S")


def test_carga_historica_no_usa_updatedafter():
    c = _ConectorFijo({"features": []})
    c.fetch(_AHORA - timedelta(days=200))
    assert all("updatedafter" not in _params(u) for u in c.urls)


def test_respuesta_sin_features_es_error():
    with pytest.raises(ConnectorError):
        _ConectorFijo({"type": "error"}).fetch(None)


def test_no_trunca_en_silencio_si_llega_al_limite():
    c = _ConectorFijo({"features": [_feature(f"id{i}") for i in range(LIMITE_USGS)]})
    with pytest.raises(ConnectorError, match="máximo"):
        c.fetch(None)


def test_rango_largo_se_pide_por_tramos_de_un_anio():
    c = _ConectorFijo({"features": []})
    c.fetch(datetime(2023, 10, 20, 12, 0, tzinfo=timezone.utc) + timedelta(hours=6))
    tramos = [(_params(u)["starttime"], _params(u).get("endtime")) for u in c.urls]
    assert tramos == [
        ("2023-10-20T12:00:00", "2024-10-19T12:00:00"),
        ("2024-10-19T12:00:00", "2025-10-19T12:00:00"),
        ("2025-10-19T12:00:00", "2026-10-19T12:00:00"),  # 2024 es bisiesto: hace falta un tramo más
        ("2026-10-19T12:00:00", None),  # el último tramo llega hasta hoy
    ]


def test_un_corte_de_red_se_reintenta_en_el_mismo_tramo():
    class _Inestable(_ConectorFijo):
        fallos = 2

        def _get_json(self, url):
            if self.fallos:
                self.fallos -= 1
                raise ConnectorError("Conexión con el USGS interrumpida (IncompleteRead)")
            return super()._get_json(url)

    pausas: list[float] = []
    c = _Inestable({"features": [_feature()]}, pausa=pausas.append)
    assert len(c.fetch(None)) == 1
    assert pausas == [1, 2]


def test_tras_agotar_intentos_el_error_sube_al_motor():
    class _Caido(_ConectorFijo):
        def _get_json(self, url):
            raise ConnectorError("sin conexión")

    with pytest.raises(ConnectorError):
        _Caido({"features": []}, pausa=lambda _: None).fetch(None)


def test_evento_en_el_borde_de_dos_tramos_no_se_repite():
    c = _ConectorFijo({"features": [_feature("borde")]})
    registros = c.fetch(datetime(2024, 10, 20, 12, 0, tzinfo=timezone.utc) + timedelta(hours=6))
    assert len(c.urls) == 2
    assert [r.external_id for r in registros] == ["borde"]


def test_crear_pipeline_elige_por_clave():
    conector, normalizador = crear_pipeline("usgs")
    assert isinstance(conector, UsgsConnector) and isinstance(normalizador, UsgsNormalizer)
    conector, _ = crear_pipeline("igp")
    assert isinstance(conector, PendienteConnector)


# ── Motor con el conector del USGS ──────────────────────────────────────────


def test_motor_con_usgs_es_idempotente_y_reporta_rechazos():
    respuesta = {"features": [_feature("a"), _feature("b"), _feature("c", lat=-40.0)]}
    repo = _RepoMemoria()

    async def _dos_pasadas():
        primera = await run_sync(
            connector=_ConectorFijo(respuesta), normalizer=UsgsNormalizer(), repository=repo, since=None
        )
        segunda = await run_sync(
            connector=_ConectorFijo(respuesta), normalizer=UsgsNormalizer(), repository=repo, since=None
        )
        return primera, segunda

    primera, segunda = asyncio.run(_dos_pasadas())
    assert (primera.leidos, primera.insertados, primera.rechazados) == (3, 2, 1)
    assert (segunda.insertados, segunda.duplicados) == (0, 2)
    assert primera.estado == "con_errores"
