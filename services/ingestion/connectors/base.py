"""Interfaz de conectores.

Un `Connector` encapsula *de dónde* salen los datos crudos. La fuente real aún no
está implementada: al integrarla solo se añade una implementación de esta misma
interfaz, sin tocar el motor de ingesta.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol, runtime_checkable


class ConnectorError(Exception):
    """Error recuperable del conector (timeout, HTTP 5xx, límite de uso…)."""


@dataclass(frozen=True)
class RawRecord:
    """Registro crudo tal como lo entrega el proveedor (sin normalizar)."""

    external_id: str
    payload: dict[str, Any]


@runtime_checkable
class Connector(Protocol):
    """Contrato mínimo. `fetch` es síncrono y se ejecuta en un hilo aparte."""

    nombre: str
    #: Intervalo mínimo entre llamadas (respeta los límites de uso del proveedor).
    intervalo_min: int

    def fetch(self, since: datetime | None) -> list[RawRecord]:
        """Devuelve los registros publicados desde `since` (o una ventana por
        defecto si es `None`). Puede lanzar `ConnectorError`."""
        ...


__all__ = ["Connector", "ConnectorError", "RawRecord"]
