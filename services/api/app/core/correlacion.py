"""Identificador de correlación de la petición en curso.

El middleware de `main.py` lo fija por petición; quien no recibe la `Request`
(p. ej. `registrar_auditoria`) lo lee de aquí. Fuera de una petición es `None`.
"""

from __future__ import annotations

from contextvars import ContextVar

correlation_id_actual: ContextVar[str | None] = ContextVar("correlation_id_actual", default=None)

__all__ = ["correlation_id_actual"]
