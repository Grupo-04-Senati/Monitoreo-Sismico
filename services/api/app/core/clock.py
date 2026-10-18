"""Reloj único del sistema.

Regla: **ningún** módulo de la API, los scripts o la ingesta llama directamente a
`datetime.now()`/`datetime.utcnow()`. Todo el "ahora" del dominio pasa por aquí.

- `now()`      → instante de dominio (reloj real UTC).
- `real_now()` → reloj real **inmutable**. Lo usa SIEMPRE la seguridad: expiración
  de JWT y cookies, bloqueo temporal por intentos fallidos y limitación de tasa.
"""

from __future__ import annotations

from datetime import datetime, timezone


def now() -> datetime:
    """Instante de dominio (reloj real UTC)."""
    return datetime.now(timezone.utc)


def real_now() -> datetime:
    """Reloj real, ignorando cualquier ancla. Uso exclusivo de la seguridad."""
    return datetime.now(timezone.utc)


__all__ = ["now", "real_now"]
