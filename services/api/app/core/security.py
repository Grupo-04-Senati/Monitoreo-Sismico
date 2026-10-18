"""Primitivas de seguridad: hash de contraseñas y tokens JWT.

- Las contraseñas se guardan **solo** como hash (bcrypt vía passlib); nunca en
  claro. Si más adelante se usa un proveedor de identidad (OIDC), este módulo
  deja de almacenar contraseñas propias.
- Los tokens de acceso son de vida corta; el refresco se guarda en cookie
  HttpOnly + Secure + SameSite (ver router de auth).
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.clock import real_now
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

REFRESH_TOKEN_EXPIRE_DAYS = 7


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(password, password_hash)
    except ValueError:
        return False


def _create_token(subject: str, token_type: str, expires: timedelta, extra: dict[str, Any] | None = None) -> str:
    now = real_now()
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.API_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    return _create_token(
        subject, "access", timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES), extra
    )


def create_refresh_token(subject: str) -> str:
    return _create_token(subject, "refresh", timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))


def decode_token(token: str) -> dict[str, Any]:
    """Devuelve el payload del token o lanza `JWTError` si es inválido/expirado."""
    return jwt.decode(token, settings.API_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


__all__ = [
    "JWTError",
    "hash_password",
    "verify_password",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    "REFRESH_TOKEN_EXPIRE_DAYS",
]
