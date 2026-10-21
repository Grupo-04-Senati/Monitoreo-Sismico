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
    #: Nombre y correo actuales del usuario (None si es el sistema o se eliminó).
    actor_name: str | None = None
    actor_email: str | None = None


class AuditLogListOut(BaseModel):
    items: list[AuditLogOut]
    total: int
    page: int
    page_size: int


class ActorFacetOut(BaseModel):
    id: str
    nombre: str | None
    email: str | None


class AuditFacetsOut(BaseModel):
    acciones: list[str]
    entidades: list[str]
    actores: list[ActorFacetOut]
    total: int
    mas_antiguo: datetime | None
