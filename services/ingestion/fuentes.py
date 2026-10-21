"""Catálogo de proveedores: qué conector y normalizador usa cada fuente.

La fuente se elige por `data_sources.key`. Una clave sin proveedor implementado
usa `PendienteConnector`, que registra una ejecución fallida con motivo claro en
vez de inventar datos.
"""

from __future__ import annotations

from datetime import datetime
from typing import Callable

from ingestion.connectors.base import Connector
from ingestion.connectors.pendiente import PendienteConnector
from ingestion.connectors.usgs import UsgsConnector
from ingestion.normalizers.base import Normalizer
from ingestion.normalizers.igp import IgpNormalizer
from ingestion.normalizers.usgs import UsgsNormalizer

#: Claves con proveedor implementado.
PROVEEDORES = ("usgs",)


def crear_pipeline(
    key: str,
    *,
    url_api: str | None = None,
    timeout_sec: float = 30.0,
    ahora: Callable[[], datetime] | None = None,
) -> tuple[Connector, Normalizer]:
    """Devuelve el conector y el normalizador para la fuente `key`."""
    if key == "usgs":
        extra = {"ahora": ahora} if ahora else {}
        return UsgsConnector(url_api, timeout_sec=timeout_sec, **extra), UsgsNormalizer(key)
    return PendienteConnector(), IgpNormalizer(key)


__all__ = ["PROVEEDORES", "crear_pipeline"]
