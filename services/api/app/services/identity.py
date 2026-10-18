"""Utilidades de identidad compartidas por los routers de auth y usuarios."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import permissions_for
from app.db.models import Role, User, UserStatus, user_roles
from app.schemas.auth import UserOut
from app.schemas.usuarios import UsuarioOut


def permisos_de(user: User) -> list[str]:
    granted: set[str] = set()
    for rol in user.role_names:
        granted |= permissions_for(rol)
    return sorted(granted)


def serializar_me(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        roles=user.role_names,
        status=user.status,
        mfa_enabled=user.mfa_enabled,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        permissions=permisos_de(user),
    )


def serializar_usuario(user: User) -> UsuarioOut:
    return UsuarioOut(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        roles=user.role_names,
        status=user.status,
        mfa_enabled=user.mfa_enabled,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        approved_at=user.approved_at,
        approved_by=user.approved_by,
        approved_by_name=user.approver.full_name if user.approver is not None else None,
    )


async def cargar_roles(db: AsyncSession, nombres: list[str]) -> list[Role]:
    """Carga los roles por nombre; lanza `ValueError` si alguno no existe."""
    limpios = [n.strip() for n in nombres if n and n.strip()]
    if not limpios:
        return []
    result = await db.execute(select(Role).where(Role.name.in_(limpios)))
    roles = list(result.scalars().all())
    encontrados = {r.name for r in roles}
    desconocidos = set(limpios) - encontrados
    if desconocidos:
        raise ValueError(f"Rol inválido: {', '.join(sorted(desconocidos))}")
    return roles


async def contar_administradores(db: AsyncSession, excluir_id: str | None = None) -> int:
    """Número de cuentas **activas** con rol Administrador."""
    stmt = (
        select(func.count(func.distinct(User.id)))
        .select_from(User)
        .join(user_roles, user_roles.c.user_id == User.id)
        .join(Role, Role.id == user_roles.c.role_id)
        .where(Role.name == "admin", User.status == UserStatus.ACTIVE)
    )
    if excluir_id:
        stmt = stmt.where(User.id != excluir_id)
    result = await db.execute(stmt)
    return int(result.scalar_one())


__all__ = [
    "permisos_de",
    "serializar_me",
    "serializar_usuario",
    "cargar_roles",
    "contar_administradores",
]
