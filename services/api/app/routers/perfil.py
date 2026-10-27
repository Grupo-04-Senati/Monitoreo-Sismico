"""Perfil del usuario: celular para avisos por SMS (decisión D31).

Cada persona gestiona **solo su propio** número (cualquier rol, con sesión). Registrar
exige consentimiento explícito; verificar confirma que el número es suyo; la baja borra
el número y el consentimiento. Todo queda en la Auditoría con el número enmascarado.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import get_current_user
from app.db.database import get_db
from app.db.models import User
from app.services import telefono

router = APIRouter()


class TelefonoIn(BaseModel):
    telefono: str = Field(min_length=9, max_length=20)
    #: Debe ser `true`: sin consentimiento explícito no se guarda el número.
    consentimiento: Literal[True]


class CodigoIn(BaseModel):
    codigo: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


def _correlacion(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


async def _yo(db: AsyncSession, actual: User) -> User:
    return await db.get(User, actual.id) or actual


@router.get("/telefono")
async def ver_telefono(actual: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    return telefono.estado(await _yo(db, actual))


@router.post("/telefono")
async def registrar_telefono(
    payload: TelefonoIn, request: Request, actual: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> dict:
    return await telefono.registrar(db, await _yo(db, actual), payload.telefono, correlation_id=_correlacion(request))


@router.post("/telefono/verificar")
async def verificar_telefono(
    payload: CodigoIn, request: Request, actual: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> dict:
    return await telefono.verificar(db, await _yo(db, actual), payload.codigo, correlation_id=_correlacion(request))


@router.delete("/telefono")
async def baja_telefono(request: Request, actual: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict:
    return await telefono.dar_de_baja(db, await _yo(db, actual), correlation_id=_correlacion(request))


__all__ = ["router"]
