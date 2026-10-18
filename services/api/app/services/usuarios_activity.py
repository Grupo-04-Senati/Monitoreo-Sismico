"""Actividad reciente de una cuenta.

Mientras no exista una tabla de auditoría (`audit_logs`) no hay fuente real de
actividad, por lo que la API devuelve una lista **vacía** en lugar de generar
entradas de ejemplo. La interfaz debe rotular este caso como "Pendiente de
auditoría".
"""

from __future__ import annotations

from datetime import datetime


def generar_actividad(
    user_id: str, roles: list[str], ultimo_acceso: datetime | None
) -> list[dict]:
    """Sin fuente de auditoría: no se inventan entradas."""
    return []


__all__ = ["generar_actividad"]
