"""Esquemas Pydantic del módulo "Usuarios y roles"."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.auth import validar_password


class RolOut(BaseModel):
    name: str
    label: str
    description: str | None = None
    usuarios: int = 0


class UsuarioOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    roles: list[str]
    status: str
    mfa_enabled: bool
    last_login_at: datetime | None = None
    created_at: datetime | None = None
    approved_at: datetime | None = None
    approved_by: str | None = None
    #: Nombre de quien aprobó la cuenta (para mostrar en la interfaz).
    approved_by_name: str | None = None


class ResumenUsuariosOut(BaseModel):
    """Resumen de cuentas para las tarjetas del módulo."""

    total: int
    pendientes: int
    activos: int
    con_mfa: int


class UsuarioCreate(BaseModel):
    """Alta directa por un Administrador (la cuenta nace activa con su rol)."""

    full_name: str = Field(min_length=3, max_length=120)
    email: EmailStr
    password: str
    roles: list[str] = Field(default_factory=list)
    mfa_enabled: bool = False

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        return validar_password(v)


class UsuarioUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=120)
    roles: list[str] | None = None
    mfa_enabled: bool | None = None


class AprobacionRequest(BaseModel):
    """Aprobación de una cuenta pendiente: asigna su rol inicial."""

    roles: list[str] = Field(min_length=1)


class PaginaUsuariosOut(BaseModel):
    items: list[UsuarioOut]
    total: int
    pagina: int
    tamano: int
    total_paginas: int


__all__ = [
    "RolOut",
    "UsuarioOut",
    "ResumenUsuariosOut",
    "UsuarioCreate",
    "UsuarioUpdate",
    "AprobacionRequest",
    "PaginaUsuariosOut",
]
