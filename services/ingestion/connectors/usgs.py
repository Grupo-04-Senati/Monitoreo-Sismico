"""Conector del catálogo de sismos del USGS (servicio FDSN, formato GeoJSON).

API pública y sin clave: https://earthquake.usgs.gov/fdsnws/event/1/
Se consulta solo el recuadro geográfico que acepta la validación
(`ingestion.validation`) y solo eventos de tipo `earthquake` (se excluyen
voladuras de cantera y explosiones).

- Primera sincronización (`since` es `None`): trae los últimos
  `ventana_inicial_dias` días.
- Siguientes: trae desde `since` menos `solape_horas`, para recoger eventos que
  el USGS publica con retraso. Los repetidos los descarta la idempotencia.

Usa la biblioteca estándar (`urllib`) para no añadir dependencias.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from ingestion.connectors.base import ConnectorError, RawRecord
from ingestion.validation import LAT_MAX, LAT_MIN, LON_MAX, LON_MIN

URL_USGS = "https://earthquake.usgs.gov/fdsnws/event/1/query"
#: Máximo de eventos por consulta que admite el servicio.
LIMITE_USGS = 20000


def _ahora_utc() -> datetime:
    return datetime.now(timezone.utc)


class UsgsConnector:
    """Obtiene eventos del USGS dentro del recuadro del Perú."""

    nombre = "usgs"
    intervalo_min = 15

    def __init__(
        self,
        url: str | None = None,
        *,
        timeout_sec: float = 30.0,
        ventana_inicial_dias: int = 365,
        solape_horas: int = 6,
        ahora: Callable[[], datetime] = _ahora_utc,
    ) -> None:
        self.url = url or URL_USGS
        self.timeout_sec = timeout_sec
        self.ventana_inicial_dias = ventana_inicial_dias
        self.solape_horas = solape_horas
        self.ahora = ahora

    def parametros(self, since: datetime | None) -> dict[str, str]:
        if since is None:
            inicio = self.ahora() - timedelta(days=self.ventana_inicial_dias)
        else:
            inicio = since - timedelta(hours=self.solape_horas)
        return {
            "format": "geojson",
            "eventtype": "earthquake",
            "starttime": inicio.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
            "minlatitude": str(LAT_MIN),
            "maxlatitude": str(LAT_MAX),
            "minlongitude": str(LON_MIN),
            "maxlongitude": str(LON_MAX),
            "orderby": "time-asc",
            "limit": str(LIMITE_USGS),
        }

    def _get_json(self, url: str) -> dict[str, Any]:
        peticion = urllib.request.Request(
            url, headers={"Accept": "application/json", "User-Agent": "sismora-ingesta/0.1"}
        )
        try:
            with urllib.request.urlopen(peticion, timeout=self.timeout_sec) as respuesta:
                return json.load(respuesta)
        except urllib.error.HTTPError as exc:
            raise ConnectorError(f"USGS respondió HTTP {exc.code}") from exc
        except urllib.error.URLError as exc:
            raise ConnectorError(f"No se pudo conectar con el USGS: {exc.reason}") from exc
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise ConnectorError("Respuesta del USGS no es JSON válido") from exc

    def fetch(self, since: datetime | None) -> list[RawRecord]:
        url = f"{self.url}?{urllib.parse.urlencode(self.parametros(since))}"
        datos = self._get_json(url)
        features = datos.get("features")
        if not isinstance(features, list):
            raise ConnectorError("Respuesta del USGS sin la lista 'features'")
        if len(features) >= LIMITE_USGS:
            # Nunca se truncan datos en silencio.
            raise ConnectorError(
                f"El USGS devolvió {LIMITE_USGS} eventos (el máximo): reduzca la ventana."
            )
        return [
            RawRecord(external_id=str(f.get("id")), payload=f)
            for f in features
            if isinstance(f, dict) and f.get("id")
        ]


__all__ = ["UsgsConnector", "URL_USGS", "LIMITE_USGS"]
