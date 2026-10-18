"""Interfaz de normalizadores.

Un `Normalizer` convierte un `RawRecord` en un `NormalizedEvent` validado, o
explica por qué se rechaza. Aísla los detalles del proveedor del resto del
sistema: cambiar de fuente no afecta a la ingesta ni a la base de datos.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from ingestion.connectors.base import RawRecord
from ingestion.models import NormalizedEvent


@dataclass
class NormalizationResult:
    event: NormalizedEvent | None = None
    motivo: str | None = None

    @property
    def ok(self) -> bool:
        return self.event is not None


class Normalizer(Protocol):
    def normalize(self, raw: RawRecord) -> NormalizationResult:
        ...


__all__ = ["Normalizer", "NormalizationResult"]
