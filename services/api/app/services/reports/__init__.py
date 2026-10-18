"""Paquete de reportes: interfaz `ReportProvider` y registro de proveedores."""

from __future__ import annotations

from app.services.reports.base import ReportData, ReportParams, ReportProvider
from app.services.reports.providers import PROVIDERS

#: Índice tipo → proveedor.
_REGISTRO: dict[str, ReportProvider] = {p.tipo: p for p in PROVIDERS}


def obtener_proveedor(tipo: str) -> ReportProvider | None:
    return _REGISTRO.get(tipo)


def listar_proveedores() -> list[ReportProvider]:
    return list(PROVIDERS)


def tipos_disponibles() -> list[str]:
    return [p.tipo for p in PROVIDERS if p.disponible]


__all__ = [
    "ReportData",
    "ReportParams",
    "ReportProvider",
    "PROVIDERS",
    "obtener_proveedor",
    "listar_proveedores",
    "tipos_disponibles",
]
