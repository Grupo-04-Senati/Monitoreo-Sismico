"""Endpoints del módulo "Usuarios y roles".

- Lectura (listar/ver): Administrador y Auditor.
- Escritura (alta, cambio de rol/estado, aprobación, suspensión): solo Administrador.
- Nunca se puede dejar el sistema sin Administrador activo.
"""

from __future__ import annotations

import base64
import os
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.clock import now as clock_now
from app.core.permissions import ROLE_LABELS, get_current_user, require_role
from app.core.security import hash_password
from app.db.database import get_db
from app.db.models import Role, User, UserStatus, user_roles
from app.schemas.usuarios import (
    AprobacionRequest,
    PaginaUsuariosOut,
    ResumenUsuariosOut,
    RolOut,
    UsuarioCreate,
    UsuarioOut,
    UsuarioUpdate,
)
from app.services.audit import registrar_auditoria
from app.services.identity import (
    cargar_roles,
    contar_administradores,
    serializar_usuario,
)
from app.services.usuarios_activity import generar_actividad

router = APIRouter()
roles_router = APIRouter()

_VER = Depends(require_role("admin", "auditor"))
_SOLO_ADMIN = Depends(require_role("admin"))


async def _obtener(db: AsyncSession, user_id: str) -> User:
    result = await db.execute(
        select(User).options(selectinload(User.roles), selectinload(User.approver)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user


def _es_admin_activo(user: User) -> bool:
    return user.status == UserStatus.ACTIVE and "admin" in user.role_names


async def _validar_ultimo_admin(
    db: AsyncSession, actor_id: str, objetivo: User, deja_de_ser_admin: bool
) -> None:
    """Impide quedarse sin Administrador activo."""
    if not deja_de_ser_admin or not _es_admin_activo(objetivo):
        return
    restantes = await contar_administradores(db, excluir_id=objetivo.id)
    if restantes == 0:
        registrar_auditoria(
            actor_id=actor_id,
            action="bloqueo_ultimo_admin",
            entity_type="user",
            entity_id=objetivo.id,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede dejar el sistema sin Administrador. Asigne otro Administrador primero.",
        )


@router.get("", response_model=PaginaUsuariosOut)
async def listar_usuarios(
    estado: str | None = Query(default=None),
    rol: str | None = Query(default=None),
    q: str | None = Query(default=None),
    orden: str = Query(default="recientes"),
    ultimo_acceso: str | None = Query(default=None),
    pagina: int = Query(default=1, ge=1),
    tamano: int = Query(default=10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = _VER,
) -> PaginaUsuariosOut:
    condiciones = []
    if estado:
        condiciones.append(User.status == estado)
    if q:
        patron = f"%{q.strip().lower()}%"
        condiciones.append(or_(func.lower(User.full_name).like(patron), func.lower(User.email).like(patron)))
    if ultimo_acceso == "nunca":
        condiciones.append(User.last_login_at.is_(None))
    elif ultimo_acceso in ("7d", "30d"):
        dias = 7 if ultimo_acceso == "7d" else 30
        condiciones.append(User.last_login_at.is_not(None))
        condiciones.append(User.last_login_at >= clock_now() - timedelta(days=dias))

    stmt = select(User).options(selectinload(User.roles), selectinload(User.approver))
    count_stmt = select(func.count(func.distinct(User.id))).select_from(User)
    if rol:
        stmt = stmt.join(user_roles, user_roles.c.user_id == User.id).join(Role, Role.id == user_roles.c.role_id)
        count_stmt = count_stmt.join(user_roles, user_roles.c.user_id == User.id).join(Role, Role.id == user_roles.c.role_id)
        condiciones.append(Role.name == rol)

    for c in condiciones:
        stmt = stmt.where(c)
        count_stmt = count_stmt.where(c)

    total = int((await db.execute(count_stmt)).scalar_one())

    if orden == "antiguos":
        stmt = stmt.order_by(User.created_at.asc(), User.id.desc())
    else:
        stmt = stmt.order_by(User.created_at.desc(), User.id.asc())
    stmt = stmt.offset((pagina - 1) * tamano).limit(tamano)
    usuarios = list((await db.execute(stmt)).scalars().unique().all())

    total_paginas = max(1, (total + tamano - 1) // tamano)
    return PaginaUsuariosOut(
        items=[serializar_usuario(u) for u in usuarios],
        total=total,
        pagina=pagina,
        tamano=tamano,
        total_paginas=total_paginas,
    )


@router.get("/summary", response_model=ResumenUsuariosOut)
async def resumen_usuarios(
    db: AsyncSession = Depends(get_db),
    _: User = _VER,
) -> ResumenUsuariosOut:
    """Resumen de cuentas (tarjetas del módulo)."""
    fila = (
        await db.execute(
            select(
                func.count(User.id),
                func.count(User.id).filter(User.status == UserStatus.PENDING),
                func.count(User.id).filter(User.status == UserStatus.ACTIVE),
                func.count(User.id).filter(User.mfa_enabled.is_(True)),
            )
        )
    ).one()
    return ResumenUsuariosOut(
        total=int(fila[0]),
        pendientes=int(fila[1]),
        activos=int(fila[2]),
        con_mfa=int(fila[3]),
    )


@router.get("/{user_id}", response_model=UsuarioOut)
async def obtener_usuario(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = _VER,
) -> UsuarioOut:
    return serializar_usuario(await _obtener(db, user_id))


@router.post("", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
async def crear_usuario(
    payload: UsuarioCreate,
    db: AsyncSession = Depends(get_db),
    actor: User = _SOLO_ADMIN,
) -> UsuarioOut:
    try:
        roles = await cargar_roles(db, payload.roles)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    email = payload.email.lower()
    existe = await db.execute(select(User.id).where(func.lower(User.email) == email))
    if existe.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe una cuenta con este correo.")

    # Alta directa por Administrador: nace activa con su rol.
    user = User(
        id=str(uuid.uuid4()),
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        status=UserStatus.ACTIVE if roles else UserStatus.PENDING,
        mfa_enabled=payload.mfa_enabled,
        mfa_secret=_nuevo_secreto() if payload.mfa_enabled else None,
        approved_by=actor.id if roles else None,
        approved_at=clock_now() if roles else None,
        roles=roles,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    registrar_auditoria(
        actor_id=actor.id,
        action="usuario_alta",
        entity_type="user",
        entity_id=user.id,
        after=serializar_usuario(user).model_dump(),
    )
    return serializar_usuario(user)


@router.patch("/{user_id}", response_model=UsuarioOut)
async def actualizar_usuario(
    user_id: str,
    payload: UsuarioUpdate,
    db: AsyncSession = Depends(get_db),
    actor: User = _SOLO_ADMIN,
) -> UsuarioOut:
    user = await _obtener(db, user_id)
    antes = serializar_usuario(user).model_dump()

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()

    if payload.roles is not None:
        try:
            roles = await cargar_roles(db, payload.roles)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
        deja_de_ser_admin = "admin" in user.role_names and "admin" not in {r.name for r in roles}
        await _validar_ultimo_admin(db, actor.id, user, deja_de_ser_admin)
        user.roles = roles

    if payload.mfa_enabled is not None:
        user.mfa_enabled = payload.mfa_enabled
        if payload.mfa_enabled and not user.mfa_secret:
            user.mfa_secret = _nuevo_secreto()

    await db.commit()
    await db.refresh(user)

    registrar_auditoria(
        actor_id=actor.id,
        action="usuario_actualizado",
        entity_type="user",
        entity_id=user.id,
        before=antes,
        after=serializar_usuario(user).model_dump(),
    )
    return serializar_usuario(user)


@router.post("/{user_id}/approve", response_model=UsuarioOut)
async def aprobar_usuario(
    user_id: str,
    payload: AprobacionRequest,
    db: AsyncSession = Depends(get_db),
    actor: User = _SOLO_ADMIN,
) -> UsuarioOut:
    user = await _obtener(db, user_id)
    if user.status != UserStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La cuenta no está pendiente de aprobación.")
    try:
        roles = await cargar_roles(db, payload.roles)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    antes = serializar_usuario(user).model_dump()
    user.roles = roles
    user.status = UserStatus.ACTIVE
    user.approved_by = actor.id
    user.approved_at = clock_now()
    await db.commit()
    await db.refresh(user)

    registrar_auditoria(
        actor_id=actor.id,
        action="usuario_aprobado",
        entity_type="user",
        entity_id=user.id,
        before=antes,
        after=serializar_usuario(user).model_dump(),
    )
    return serializar_usuario(user)


@router.post("/{user_id}/suspend", response_model=UsuarioOut)
async def suspender_usuario(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    actor: User = _SOLO_ADMIN,
) -> UsuarioOut:
    user = await _obtener(db, user_id)
    if user.id == actor.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No puede suspender su propia cuenta.")
    if user.status == UserStatus.SUSPENDED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La cuenta ya está suspendida.")

    await _validar_ultimo_admin(db, actor.id, user, True)
    antes = serializar_usuario(user).model_dump()
    user.status = UserStatus.SUSPENDED
    await db.commit()
    await db.refresh(user)

    registrar_auditoria(
        actor_id=actor.id,
        action="usuario_suspendido",
        entity_type="user",
        entity_id=user.id,
        before=antes,
        after=serializar_usuario(user).model_dump(),
    )
    return serializar_usuario(user)


@router.post("/{user_id}/reactivate", response_model=UsuarioOut)
async def reactivar_usuario(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    actor: User = _SOLO_ADMIN,
) -> UsuarioOut:
    user = await _obtener(db, user_id)
    if user.status == UserStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La cuenta ya está activa.")
    if not user.role_names:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Asigne un rol antes de reactivar la cuenta.")

    antes = serializar_usuario(user).model_dump()
    user.status = UserStatus.ACTIVE
    await db.commit()
    await db.refresh(user)

    registrar_auditoria(
        actor_id=actor.id,
        action="usuario_reactivado",
        entity_type="user",
        entity_id=user.id,
        before=antes,
        after=serializar_usuario(user).model_dump(),
    )
    return serializar_usuario(user)


@router.get("/{user_id}/activity")
async def actividad_usuario(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    actor: User = Depends(get_current_user),
) -> dict:
    """Actividad reciente del usuario.

    Los eventos reales viven en `audit_logs` (Fase posterior). Mientras tanto se
    devuelve un resumen mínimo sin datos sensibles.
    """
    if not set(actor.role_names).intersection({"admin", "auditor"}) and actor.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permisos para esta acción")
    user = await _obtener(db, user_id)
    return {
        "items": generar_actividad(user.id, user.role_names, user.last_login_at),
        "usuario": user.id,
        "ultimo_acceso": user.last_login_at,
    }


@roles_router.get("/roles", response_model=list[RolOut])
async def listar_roles(
    db: AsyncSession = Depends(get_db),
    _: User = _VER,
) -> list[RolOut]:
    result = await db.execute(select(Role).order_by(Role.id))
    roles = list(result.scalars().all())
    conteo = dict(
        (await db.execute(
            select(Role.name, func.count(user_roles.c.user_id))
            .join(user_roles, user_roles.c.role_id == Role.id)
            .group_by(Role.name)
        )).all()
    )
    return [
        RolOut(
            name=r.name,
            label=ROLE_LABELS.get(r.name, r.label),
            description=r.description,
            usuarios=int(conteo.get(r.name, 0)),
        )
        for r in roles
    ]


def _nuevo_secreto() -> str:
    """Secreto TOTP base32 (se entrega al usuario al inscribir el MFA)."""
    return base64.b32encode(os.urandom(10)).decode("ascii").rstrip("=")
