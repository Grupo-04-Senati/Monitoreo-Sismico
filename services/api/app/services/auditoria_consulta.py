"""Consultas sobre la bitácora `audit_logs` (PDF §6.13): filtros, nombres de los
usuarios, valores para los filtros y filas para exportar. Solo lectura."""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import Any

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog, User

#: Tope de filas de una exportación (evita archivos enormes por error).
MAX_EXPORTACION = 50_000


def filtros(
    *,
    actor_id: str | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    desde: datetime | None = None,
    hasta: datetime | None = None,
) -> list:
    condiciones = []
    if actor_id:
        condiciones.append(AuditLog.actor_id == actor_id)
    if action:
        condiciones.append(AuditLog.action == action)
    if entity_type:
        condiciones.append(AuditLog.entity_type == entity_type)
    if entity_id:
        condiciones.append(AuditLog.entity_id == entity_id)
    if desde:
        condiciones.append(AuditLog.occurred_at >= desde)
    if hasta:
        condiciones.append(AuditLog.occurred_at <= hasta)
    return condiciones


async def nombres(db: AsyncSession, ids: set[str | None]) -> dict[str, tuple[str, str]]:
    """id de usuario → (nombre, correo). Un actor borrado o del sistema no aparece."""
    validos = {i for i in ids if i}
    if not validos:
        return {}
    filas = (await db.execute(select(User.id, User.full_name, User.email).where(User.id.in_(validos)))).all()
    return {f.id: (f.full_name, f.email) for f in filas}


async def valores_filtro(db: AsyncSession) -> dict[str, Any]:
    acciones = (await db.execute(select(distinct(AuditLog.action)).order_by(AuditLog.action))).scalars().all()
    entidades = (await db.execute(select(distinct(AuditLog.entity_type)).order_by(AuditLog.entity_type))).scalars().all()
    actores = (await db.execute(select(distinct(AuditLog.actor_id)).where(AuditLog.actor_id.is_not(None)))).scalars().all()
    mapa = await nombres(db, set(actores))
    total = await db.scalar(select(func.count()).select_from(AuditLog)) or 0
    mas_antiguo = await db.scalar(select(func.min(AuditLog.occurred_at)))
    return {
        "acciones": list(acciones),
        "entidades": list(entidades),
        "actores": sorted(
            ({"id": a, "nombre": mapa[a][0] if a in mapa else None, "email": mapa[a][1] if a in mapa else None} for a in actores),
            key=lambda x: (x["nombre"] is None, x["nombre"] or x["id"]),
        ),
        "total": total,
        "mas_antiguo": mas_antiguo,
    }


async def csv_exportacion(db: AsyncSession, condiciones: list) -> tuple[str, int]:
    """CSV (UTF-8 con BOM para Excel) de los registros filtrados, más recientes primero."""
    filas = (
        await db.execute(
            select(AuditLog).where(*condiciones).order_by(AuditLog.occurred_at.desc(), AuditLog.id).limit(MAX_EXPORTACION)
        )
    ).scalars().all()
    mapa = await nombres(db, {f.actor_id for f in filas})
    salida = io.StringIO()
    escritor = csv.writer(salida)
    escritor.writerow(["fecha_utc", "usuario", "correo", "actor_id", "accion", "entidad", "id_entidad", "antes", "despues", "correlacion"])
    for f in filas:
        nombre, correo = mapa.get(f.actor_id or "", ("", ""))
        escritor.writerow([
            f.occurred_at.isoformat(), nombre, correo, f.actor_id or "", f.action, f.entity_type, f.entity_id or "",
            json.dumps(f.before_json, ensure_ascii=False) if f.before_json is not None else "",
            json.dumps(f.after_json, ensure_ascii=False) if f.after_json is not None else "",
            f.correlation_id or "",
        ])
    return "﻿" + salida.getvalue(), len(filas)


__all__ = ["MAX_EXPORTACION", "filtros", "nombres", "valores_filtro", "csv_exportacion"]
