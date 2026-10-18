"""Conector pendiente.

La fuente real todavía no está implementada. Este conector existe para que el
motor de ingesta pueda ejecutarse y registrar una ejecución **fallida** con un
motivo claro, en lugar de generar datos simulados.
"""

from __future__ import annotations

from datetime import datetime

from ingestion.connectors.base import ConnectorError, RawRecord

#: Ventana esperada entre llamadas (la programación real es cada 15 min).
WINDOW_MIN = 15


class PendienteConnector:
    """No entrega registros: la fuente real aún no está implementada."""

    nombre = "pendiente"
    intervalo_min = WINDOW_MIN

    def fetch(self, since: datetime | None) -> list[RawRecord]:
        raise ConnectorError("La fuente real aún no está implementada.")


__all__ = ["PendienteConnector", "WINDOW_MIN"]
