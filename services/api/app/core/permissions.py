"""Matriz de permisos y dependencias de autorización.

La autorización se aplica **siempre** en el backend con `require_role()` /
`require_permission()`: ocultar un módulo en el frontend no protege la API.
La matriz replica la sección 7 del prompt maestro.
"""

from __future__ import annotations

from typing import Awaitable, Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import JWTError, decode_token
from app.db.database import get_db
from app.db.models import Role, User, UserStatus

#: Roles válidos del sistema.
ROLES: tuple[str, ...] = ("admin", "analyst", "alert_operator", "auditor", "viewer")

ROLE_LABELS: dict[str, str] = {
    "admin": "Administrador",
    "analyst": "Analista",
    "alert_operator": "Operador de alertas",
    "auditor": "Auditor",
    "viewer": "Solo lectura",
}

#: Permiso por rol (sección 7 del prompt maestro). "ver" como base; las
#: variantes "_exportar" / "_sincronizar" / "_configurar" son de operación.
PERMISSIONS: dict[str, set[str]] = {
    "admin": {
        "dashboard", "eventos", "eventos_exportar", "mapa", "analisis",
        "preparacion", "modelos", "estimaciones", "reglas", "alertas",
        "fuentes", "fuentes_sincronizar", "fuentes_configurar",
        "reportes", "reportes_generar", "reportes_pdf",
        "usuarios", "auditoria", "configuracion",
    },
    "analyst": {
        "dashboard", "eventos", "eventos_exportar", "mapa", "analisis",
        "preparacion", "modelos", "estimaciones", "fuentes",
        "reportes", "reportes_generar", "reportes_pdf",
    },
    "alert_operator": {
        "dashboard", "eventos", "eventos_exportar", "mapa", "reglas", "alertas",
        "reportes", "reportes_generar",
    },
    "auditor": {
        "dashboard", "eventos", "eventos_exportar", "mapa", "analisis",
        "fuentes", "auditoria", "reportes", "reportes_generar",
    },
    "viewer": {"dashboard", "eventos", "mapa", "reportes"},
}

#: Módulos de la matriz "Ver / Operar" que expone el frontend (informe).
PERMISSION_MATRIX: list[dict[str, str]] = [
    {"modulo": "dashboard", "etiqueta": "Dashboard", "admin": "ver", "analyst": "ver", "alert_operator": "ver", "auditor": "ver", "viewer": "ver"},
    {"modulo": "eventos", "etiqueta": "Eventos sísmicos", "admin": "operar", "analyst": "operar", "alert_operator": "operar", "auditor": "ver", "viewer": "ver"},
    {"modulo": "mapa", "etiqueta": "Mapa sísmico", "admin": "ver", "analyst": "ver", "alert_operator": "ver", "auditor": "ver", "viewer": "ver"},
    {"modulo": "analisis", "etiqueta": "Análisis estadístico", "admin": "ver", "analyst": "ver", "alert_operator": "sin_acceso", "auditor": "ver", "viewer": "sin_acceso"},
    {"modulo": "fuentes", "etiqueta": "Fuentes de datos", "admin": "operar", "analyst": "ver", "alert_operator": "sin_acceso", "auditor": "ver", "viewer": "sin_acceso"},
    {"modulo": "reportes", "etiqueta": "Reportes", "admin": "operar", "analyst": "operar", "alert_operator": "operar", "auditor": "ver", "viewer": "ver"},
    {"modulo": "usuarios", "etiqueta": "Usuarios y roles", "admin": "operar", "analyst": "sin_acceso", "alert_operator": "sin_acceso", "auditor": "ver", "viewer": "sin_acceso"},
]


def permissions_for(role: str) -> set[str]:
    return PERMISSIONS.get(role, set())


_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resuelve el usuario autenticado desde el token Bearer.

    Responde 401 con un mensaje genérico cuando el token falta, es inválido o
    la cuenta no está activa (no se filtra si el usuario existe).
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or not credentials.credentials:
        # Permite también la cookie de sesión cuando el navegador la envía.
        cookie_token = request.cookies.get("access_token")
        if not cookie_token:
            raise unauthorized
        token = cookie_token
    else:
        token = credentials.credentials

    try:
        payload = decode_token(token)
    except JWTError:
        raise unauthorized

    if payload.get("type") != "access":
        raise unauthorized

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None or user.status != UserStatus.ACTIVE:
        raise unauthorized
    return user


def require_role(*roles: str) -> Callable[..., Awaitable[User]]:
    """Dependencia que exige uno de los roles indicados (403 si no aplica)."""

    async def _dep(user: User = Depends(get_current_user)) -> User:
        if not set(user.role_names).intersection(roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permisos para esta acción",
            )
        return user

    return _dep


def require_permission(*perms: str, require_all: bool = False) -> Callable[..., Awaitable[User]]:
    """Dependencia que exige uno (o todos) de los permisos indicados."""

    async def _dep(user: User = Depends(get_current_user)) -> User:
        granted: set[str] = set()
        for role in user.role_names:
            granted |= permissions_for(role)
        ok = all(p in granted for p in perms) if require_all else any(p in granted for p in perms)
        if not ok:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permisos para esta acción",
            )
        return user

    return _dep


__all__ = [
    "ROLES",
    "ROLE_LABELS",
    "PERMISSIONS",
    "PERMISSION_MATRIX",
    "Role",
    "permissions_for",
    "get_current_user",
    "require_role",
    "require_permission",
]
