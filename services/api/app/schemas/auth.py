"""Esquemas Pydantic de autenticación."""

from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

_RE_MAYUS = re.compile(r"[A-Z]")
_RE_MINUS = re.compile(r"[a-z]")
_RE_NUM = re.compile(r"[0-9]")
_RE_ESPECIAL = re.compile(r"[^A-Za-z0-9]")


def validar_password(valor: str) -> str:
    """Reglas de contraseña: mín. 8, mayúscula, minúscula, número y especial."""
    if len(valor) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres")
    if not _RE_MAYUS.search(valor):
        raise ValueError("La contraseña debe incluir una letra mayúscula")
    if not _RE_MINUS.search(valor):
        raise ValueError("La contraseña debe incluir una letra minúscula")
    if not _RE_NUM.search(valor):
        raise ValueError("La contraseña debe incluir un número")
    if not _RE_ESPECIAL.search(valor):
        raise ValueError("La contraseña debe incluir un carácter especial")
    return valor


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    #: Código TOTP opcional ("si disponible").
    mfa_code: str | None = None
    remember: bool = False


class UserOut(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    roles: list[str]
    status: str
    mfa_enabled: bool
    last_login_at: datetime | None = None
    created_at: datetime | None = None
    permissions: list[str] = Field(default_factory=list)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=3, max_length=120)
    email: EmailStr
    password: str
    accept_terms: bool

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        return validar_password(v)

    @field_validator("accept_terms")
    @classmethod
    def _terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Debe aceptar los términos y condiciones")
        return v


class RegisterResponse(BaseModel):
    message: str
    status: str


__all__ = [
    "LoginRequest",
    "UserOut",
    "TokenResponse",
    "RegisterRequest",
    "RegisterResponse",
    "validar_password",
]
