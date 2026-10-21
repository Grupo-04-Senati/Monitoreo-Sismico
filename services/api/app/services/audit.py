"""Registro de auditoría.

Toda alta, cambio de rol, cambio de estado, aprobación, suspensión y los
intentos de acceso fallidos se registran con `registrar_auditoria()`.

Cada evento va a dos destinos:

1. **Log estructurado** (JSON por línea, `sismo.audit`), inmediato. Sirve de
   respaldo si la base no está disponible.
2. **Tabla `audit_logs`**, de solo inserción (un trigger impide modificarla).

La firma no cambia respecto a la versión que solo escribía el log: sigue siendo
síncrona y sin sesión, porque se llama después del `commit` del cambio o justo
antes de rechazar una petición (login fallido, acción denegada), y esos eventos
también deben quedar. La escritura en la tabla usa su propia sesión y corre en
segundo plano para no bloquear la petición; `esperar_auditoria()` espera a que
terminen las pendientes (al apagar la API o al final de un script).
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from app.core.clock import now as clock_now
from app.core.correlacion import correlation_id_actual
from app.db.database import AsyncSessionLocal
from app.db.models import AuditLog

audit_logger = logging.getLogger("sismo.audit")

#: Escrituras en curso (referencia fuerte para que no se pierdan).
_pendientes: set[asyncio.Task[None]] = set()


def _limpio(valor: Any) -> Any:
    """Descarta secretos antes de registrar (nunca hash, token ni contraseña)."""
    if not isinstance(valor, dict):
        return valor
    prohibidos = {
        "password", "password_hash", "hashed_password", "mfa_secret",
        "token", "access_token", "refresh_token", "secret",
    }
    return {k: v for k, v in valor.items() if k not in prohibidos}


def _a_json(valor: dict[str, Any] | None) -> dict[str, Any] | None:
    """Normaliza a tipos JSON (fechas y UUID como texto), igual que el log."""
    if valor is None:
        return None
    return json.loads(json.dumps(valor, ensure_ascii=False, default=str))


async def _persistir(ocurrido: datetime, evento: dict[str, Any]) -> None:
    try:
        async with AsyncSessionLocal() as db:
            db.add(
                AuditLog(
                    actor_id=evento["actor_id"],
                    action=evento["action"],
                    entity_type=evento["entity_type"],
                    entity_id=evento["entity_id"],
                    before_json=_a_json(evento["before"]),
                    after_json=_a_json(evento["after"]),
                    occurred_at=ocurrido,
                    correlation_id=evento["correlation_id"],
                )
            )
            await db.commit()
    except Exception as exc:  # noqa: BLE001 - la auditoría nunca tumba la operación
        # Solo el tipo de error: el mensaje del driver puede incluir los valores.
        audit_logger.error(
            "No se pudo guardar el evento en audit_logs (%s); queda solo en este log.",
            type(exc).__name__,
        )


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
    """Registra un evento de auditoría con antes/después, sin secretos."""
    ocurrido = clock_now()
    evento = {
        "ts": ocurrido.isoformat(),
        "actor_id": actor_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "before": _limpio(before),
        "after": _limpio(after),
        # Si el llamador no lo pasa, se toma el de la petición en curso.
        "correlation_id": correlation_id or correlation_id_actual.get(),
    }
    audit_logger.info(json.dumps(evento, ensure_ascii=False, default=str))

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # Llamada desde código síncrono: se escribe antes de volver.
        asyncio.run(_persistir(ocurrido, evento))
        return
    tarea = loop.create_task(_persistir(ocurrido, evento))
    _pendientes.add(tarea)
    tarea.add_done_callback(_pendientes.discard)


async def esperar_auditoria() -> None:
    """Espera a que terminen las escrituras pendientes en `audit_logs`."""
    if _pendientes:
        await asyncio.gather(*list(_pendientes), return_exceptions=True)


__all__ = ["registrar_auditoria", "esperar_auditoria"]
