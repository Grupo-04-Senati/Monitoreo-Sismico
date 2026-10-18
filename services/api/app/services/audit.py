"""Registro de auditoría.

Toda alta, cambio de rol, cambio de estado, aprobación, suspensión y los
intentos de acceso fallidos se registran con `registrar_auditoria()`.

Mientras no exista la tabla `audit_logs` (Fase del módulo Auditoría), la
auditoría se emite como log estructurado (JSON por línea). La firma es estable
para que, al crear la tabla, solo cambie el destino.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.core.clock import now as clock_now

audit_logger = logging.getLogger("sismo.audit")


def _limpio(valor: Any) -> Any:
    """Descarta secretos antes de registrar (nunca hash, token ni contraseña)."""
    if not isinstance(valor, dict):
        return valor
    prohibidos = {
        "password", "password_hash", "hashed_password", "mfa_secret",
        "token", "access_token", "refresh_token", "secret",
    }
    return {k: v for k, v in valor.items() if k not in prohibidos}


def registrar_auditoria(
    *,
    actor_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    correlation_id: str | None = None,
) -> None:
    """Emite un evento de auditoría con antes/después, sin secretos."""
    evento = {
        "ts": clock_now().isoformat(),
        "actor_id": actor_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "before": _limpio(before),
        "after": _limpio(after),
        "correlation_id": correlation_id,
    }
    audit_logger.info(json.dumps(evento, ensure_ascii=False, default=str))


__all__ = ["registrar_auditoria"]
