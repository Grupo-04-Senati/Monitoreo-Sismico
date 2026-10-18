"""Endpoints de autenticación: login, registro, logout, refresco y sesión."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import now as clock_now
from app.core.config import settings
from app.core.permissions import get_current_user
from app.core.security import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    JWTError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.totp import verificar_totp
from app.db.database import get_db
from app.db.models import User, UserStatus
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
)
from app.services.audit import registrar_auditoria
from app.services.identity import serializar_me
from app.services.login_throttle import (
    limpiar_intentos,
    permitir_intento_ip,
    registrar_fallo,
    segundos_bloqueado,
)

router = APIRouter()

#: Mensaje único de credenciales: no revela si el correo existe.
CREDENCIALES_INVALIDAS = "Credenciales inválidas"


def _set_session_cookies(response: Response, access: str, refresh: str) -> None:
    comun = dict(
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )
    response.set_cookie(
        "access_token", access, max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, **comun
    )
    response.set_cookie(
        "refresh_token", refresh, max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400, **comun
    )


def _clear_session_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    ip = request.client.host if request.client else "desconocida"

    if not permitir_intento_ip(ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Espere un momento e intente de nuevo.",
        )

    restante = segundos_bloqueado(payload.email)
    if restante > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Cuenta bloqueada temporalmente por intentos fallidos. Intente más tarde.",
        )

    email = payload.email.lower()
    result = await db.execute(select(User).where(func.lower(User.email) == email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password_hash):
        registrar_fallo(payload.email)
        registrar_auditoria(
            actor_id=None,
            action="login_fallido",
            entity_type="auth",
            after={"email": email, "ip": ip},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=CREDENCIALES_INVALIDAS
        )

    if user.mfa_enabled:
        if not payload.mfa_code:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Se requiere un código de verificación (MFA).",
            )
        if not verificar_totp(user.mfa_secret, payload.mfa_code):
            registrar_fallo(payload.email)
            registrar_auditoria(
                actor_id=user.id,
                action="login_fallido_mfa",
                entity_type="auth",
                entity_id=user.id,
                after={"ip": ip},
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail=CREDENCIALES_INVALIDAS
            )

    if user.status == UserStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Su cuenta está pendiente de aprobación por un Administrador.",
        )
    if user.status == UserStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Su cuenta está suspendida. Contacte al Administrador.",
        )
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Su cuenta no está habilitada.",
        )

    limpiar_intentos(payload.email)
    user.last_login_at = clock_now()
    user.failed_attempts = 0
    user.locked_until = None
    await db.commit()
    await db.refresh(user)

    access = create_access_token(user.id, extra={"roles": user.role_names})
    refresh = create_refresh_token(user.id)
    _set_session_cookies(response, access, refresh)

    registrar_auditoria(
        actor_id=user.id,
        action="login",
        entity_type="auth",
        entity_id=user.id,
        after={"ip": ip},
    )

    return TokenResponse(
        access_token=access,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=serializar_me(user),
    )


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> RegisterResponse:
    email = payload.email.lower()
    existente = await db.execute(select(User.id).where(func.lower(User.email) == email))
    if existente.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta con este correo.",
        )

    # Nace "pendiente" y **sin rol**: el rol lo asigna un Administrador.
    user = User(
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        status=UserStatus.PENDING,
        mfa_enabled=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    registrar_auditoria(
        actor_id=None,
        action="usuario_registrado",
        entity_type="user",
        entity_id=user.id,
        after={"email": email, "status": UserStatus.PENDING},
    )

    return RegisterResponse(
        message="Registro recibido. Un Administrador debe aprobar la cuenta y asignar un rol.",
        status=UserStatus.PENDING,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response, user: User = Depends(get_current_user)) -> Response:
    # Se devuelve el MISMO `Response` inyectado para no perder las cabeceras
    # `Set-Cookie` que borran la sesión.
    _clear_session_cookies(response)
    registrar_auditoria(actor_id=user.id, action="logout", entity_type="auth", entity_id=user.id)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    token = request.cookies.get("refresh_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión no válida"
        )
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión no válida"
        )
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión no válida"
        )

    result = await db.execute(select(User).where(User.id == payload.get("sub")))
    user = result.scalar_one_or_none()
    if user is None or user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Sesión no válida"
        )

    access = create_access_token(user.id, extra={"roles": user.role_names})
    nuevo_refresh = create_refresh_token(user.id)
    _set_session_cookies(response, access, nuevo_refresh)

    return TokenResponse(
        access_token=access,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=serializar_me(user),
    )


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return serializar_me(user)
