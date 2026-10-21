"""Conector del catálogo de sismos del USGS (servicio FDSN, formato GeoJSON).

API pública y sin clave: https://earthquake.usgs.gov/fdsnws/event/1/
Se consulta solo el recuadro geográfico que acepta la validación
(`ingestion.validation`) y solo eventos de tipo `earthquake` (se excluyen
voladuras de cantera y explosiones).

- Primera sincronización (`since` es `None`): trae los últimos
  `ventana_inicial_dias` días.
- Siguientes: trae desde `since` menos `solape_horas`, para recoger eventos que
  el USGS publica con retraso. Los repetidos los descarta la idempotencia.
- Sincronización normal (la última fue hace menos de `ventana_revisiones_dias`): se
  piden los eventos de esa ventana **modificados** desde la última sincronización
  (`updatedafter`). Así llegan los nuevos y también las correcciones que el USGS
  publica días después (magnitud, ubicación, revisión), que se aplican al guardar (D27).
- Rangos largos (carga histórica) se piden por tramos de `dias_por_tramo` días,
  y cada tramo se reintenta ante cortes de red: una sola descarga grande es
  frágil con una conexión inestable.

Usa la biblioteca estándar (`urllib`) para no añadir dependencias.
"""

from __future__ import annotations

import http.client
import json
import time
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
        dias_por_tramo: int = 365,
        intentos_por_tramo: int = 3,
        ventana_revisiones_dias: int = 60,
        ahora: Callable[[], datetime] = _ahora_utc,
        pausa: Callable[[float], None] = time.sleep,
    ) -> None:
        self.url = url or URL_USGS
        self.timeout_sec = timeout_sec
        self.ventana_inicial_dias = ventana_inicial_dias
        self.solape_horas = solape_horas
        self.dias_por_tramo = dias_por_tramo
        self.intentos_por_tramo = intentos_por_tramo
        self.ventana_revisiones_dias = ventana_revisiones_dias
        self.ahora = ahora
        self.pausa = pausa

    def inicio(self, since: datetime | None) -> datetime:
        if since is None:
            return self.ahora() - timedelta(days=self.ventana_inicial_dias)
        return since - timedelta(hours=self.solape_horas)

    def tramos(self, since: datetime | None) -> list[tuple[datetime, datetime | None]]:
        """Intervalos [inicio, fin) a consultar; el último queda abierto (hasta hoy)."""
        desde = self.inicio(since)
        ahora = self.ahora()
        paso = timedelta(days=self.dias_por_tramo)
        tramos: list[tuple[datetime, datetime | None]] = []
        while desde + paso < ahora:
            tramos.append((desde, desde + paso))
            desde += paso
        tramos.append((desde, None))
        return tramos

    @staticmethod
    def _fmt(momento: datetime) -> str:
        return momento.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")

    def parametros(self, since: datetime | None, fin: datetime | None = None) -> dict[str, str]:
        """Parámetros de la consulta que empieza en `inicio(since)` (y acaba en `fin`)."""
        return self._params(self.inicio(since), fin)

    def modo_actualizados(self, since: datetime | None) -> bool:
        """Sincronización normal y reciente: pedir lo modificado, no solo lo nuevo."""
        return since is not None and self.ahora() - since <= timedelta(days=self.ventana_revisiones_dias)

    def _params(self, inicio: datetime, fin: datetime | None, actualizados_desde: datetime | None = None) -> dict[str, str]:
        params = {
            "format": "geojson",
            "eventtype": "earthquake",
            "starttime": self._fmt(inicio),
            "minlatitude": str(LAT_MIN),
            "maxlatitude": str(LAT_MAX),
            "minlongitude": str(LON_MIN),
            "maxlongitude": str(LON_MAX),
            "orderby": "time-asc",
            "limit": str(LIMITE_USGS),
        }
        if fin is not None:
            params["endtime"] = self._fmt(fin)
        if actualizados_desde is not None:
            params["updatedafter"] = self._fmt(actualizados_desde)
        return params

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
        except (http.client.HTTPException, OSError) as exc:
            # Cortes a mitad de descarga (IncompleteRead), reinicios y timeouts.
            raise ConnectorError(f"Conexión con el USGS interrumpida ({type(exc).__name__})") from exc

    def _features_de_tramo(
        self, inicio: datetime, fin: datetime | None, actualizados_desde: datetime | None = None
    ) -> list[dict[str, Any]]:
        url = f"{self.url}?{urllib.parse.urlencode(self._params(inicio, fin, actualizados_desde))}"
        for intento in range(1, self.intentos_por_tramo + 1):
            try:
                datos = self._get_json(url)
                break
            except ConnectorError:
                if intento == self.intentos_por_tramo:
                    raise
                self.pausa(2 ** (intento - 1))
        features = datos.get("features")
        if not isinstance(features, list):
            raise ConnectorError("Respuesta del USGS sin la lista 'features'")
        if len(features) >= LIMITE_USGS:
            # Nunca se truncan datos en silencio.
            raise ConnectorError(
                f"El USGS devolvió {LIMITE_USGS} eventos (el máximo): reduzca el tramo."
            )
        return features

    def fetch(self, since: datetime | None) -> list[RawRecord]:
        registros: list[RawRecord] = []
        vistos: set[str] = set()
        if self.modo_actualizados(since):
            consultas = [(
                self.ahora() - timedelta(days=self.ventana_revisiones_dias), None,
                since - timedelta(hours=self.solape_horas),  # type: ignore[operator]
            )]
        else:
            consultas = [(inicio, fin, None) for inicio, fin in self.tramos(since)]
        for inicio, fin, actualizados_desde in consultas:
            for f in self._features_de_tramo(inicio, fin, actualizados_desde):
                if isinstance(f, dict) and f.get("id") and str(f["id"]) not in vistos:
                    vistos.add(str(f["id"]))
                    registros.append(RawRecord(external_id=str(f["id"]), payload=f))
        return registros


__all__ = ["UsgsConnector", "URL_USGS", "LIMITE_USGS"]
