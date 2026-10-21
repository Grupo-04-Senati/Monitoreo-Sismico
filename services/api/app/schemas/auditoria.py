"""Esquemas del módulo "Auditoría" (6.13)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    actor_id: str | None
    action: str
    entity_type: str
    entity_id: str | None
    before_json: dict[str, Any] | None
    after_json: dict[str, Any] | None
    occurred_at: datetime
    correlation_id: str | None


class AuditLogListOut(BaseModel):
    items: list[AuditLogOut]
    total: int
    page: int
    page_size: int
