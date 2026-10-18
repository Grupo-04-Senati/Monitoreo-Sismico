"""Contrato de los proveedores de reportes (interfaz `ReportProvider`).

Cada tipo de informe implementa `ReportProvider`. Los módulos que aún no están
disponibles (Modelos ML y Alertas) registran un proveedor con
`disponible = False`, de modo que la interfaz los muestre como
"Disponible próximamente" sin bloquear al resto.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Protocol, runtime_checkable

from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(slots=True)
class ReportParams:
    """Parámetros de generación de un informe.

    Son la entrada que hace **reproducible** el informe: con los mismos filtros
    y la misma fecha de corte se obtienen las mismas filas.
    """

    tipo: str
    formato: str
    corte: date
    periodo: str | None = None
    desde: date | None = None
    hasta: date | None = None
    zona: str | None = None
    filtros: dict[str, Any] = field(default_factory=dict)
    #: Nombre visible del solicitante (queda impreso en el informe).
    solicitante: str = ""


@dataclass(slots=True)
class ReportData:
    """Contenido tabular de un informe ya generado."""

    nombre: str
    columnas: list[str]
    filas: list[list[str]]
    fuente: str
    #: Metadatos impresos en la cabecera (fecha de corte, filtros, etc.).
    metadatos: list[tuple[str, str]] = field(default_factory=list)


@runtime_checkable
class ReportProvider(Protocol):
    """Interfaz que implementa cada tipo de informe."""

    tipo: str
    etiqueta: str
    disponible: bool
    formatos: tuple[str, ...]

    async def generar(self, db: AsyncSession, params: ReportParams) -> ReportData:
        """Genera el contenido tabular del informe."""
        ...


__all__ = ["ReportParams", "ReportData", "ReportProvider"]
