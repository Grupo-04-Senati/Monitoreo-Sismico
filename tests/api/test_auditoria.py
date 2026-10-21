"""Pruebas de la auditoría persistente (PDF §6.13 y §7, tabla `audit_logs`).

Necesitan PostgreSQL con las migraciones aplicadas (`alembic upgrade head`);
si la base no responde, se omiten. Usan `entity_type="prueba_automatica"` y,
al terminar, retiran sus filas desactivando el trigger dentro de una sola
transacción (solo el dueño de la tabla puede hacerlo).

Ejecución (desde la raíz del repo):

    pytest tests/api -q
"""

from __future__ import annotations

import asyncio
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.core.correlacion import correlation_id_actual
from app.core.permissions import get_current_user
from app.db.database import AsyncSessionLocal, engine
from app.db.models import AuditLog
from app.main import app
from app.services.audit import esperar_auditoria, registrar_auditoria

TIPO = "prueba_automatica"


def _ejecutar(corrutina_factoria):
    """Corre una corrutina en un bucle nuevo, sin reutilizar conexiones de otro bucle."""

    async def _envoltura():
        await engine.dispose(close=False)
        try:
            return await corrutina_factoria()
        finally:
            await engine.dispose()

    return asyncio.run(_envoltura())


async def _base_disponible() -> bool:
    try:
        async with asyncio.timeout(5):
            async with engine.connect() as conn:
                return bool(await conn.scalar(text("SELECT to_regclass('audit_logs') IS NOT NULL")))
    except Exception:  # noqa: BLE001
        return False


if not _ejecutar(_base_disponible):
    pytest.skip("PostgreSQL no disponible o sin la migración 0011", allow_module_level=True)


async def _limpiar() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_inmutable"))
        await conn.execute(text("DELETE FROM audit_logs WHERE entity_type = :t"), {"t": TIPO})
        await conn.execute(text("ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_inmutable"))


@pytest.fixture(autouse=True)
def limpiar_filas_de_prueba():
    yield
    _ejecutar(_limpiar)
    app.dependency_overrides.clear()


def test_registrar_auditoria_persiste_sin_secretos_y_con_correlacion():
    entidad = str(uuid.uuid4())

    async def _caso():
        token = correlation_id_actual.set("corr-prueba")
        try:
            registrar_auditoria(
                actor_id="actor-prueba",
                action="cambio_de_prueba",
                entity_type=TIPO,
                entity_id=entidad,
                before={"status": "pending", "password_hash": "no-debe-guardarse"},
                after={"status": "active", "token": "no-debe-guardarse"},
            )
        finally:
            correlation_id_actual.reset(token)
        await esperar_auditoria()
        async with AsyncSessionLocal() as db:
            return (await db.execute(select(AuditLog).where(AuditLog.entity_id == entidad))).scalar_one()

    fila = _ejecutar(_caso)
    assert fila.action == "cambio_de_prueba"
    assert fila.actor_id == "actor-prueba"
    assert fila.before_json == {"status": "pending"}
    assert fila.after_json == {"status": "active"}
    assert fila.correlation_id == "corr-prueba"
    assert fila.occurred_at.tzinfo is not None


def test_audit_logs_es_de_solo_insercion():
    async def _caso():
        registrar_auditoria(actor_id=None, action="inmutable", entity_type=TIPO)
        await esperar_auditoria()
        errores = []
        for sentencia in (
            "UPDATE audit_logs SET action = 'alterado' WHERE entity_type = :t",
            "DELETE FROM audit_logs WHERE entity_type = :t",
        ):
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(sentencia), {"t": TIPO})
            except DBAPIError as exc:
                errores.append(str(exc.orig))
        return errores

    errores = _ejecutar(_caso)
    assert len(errores) == 2
    assert all("solo insercion" in e for e in errores)


def test_endpoint_lista_y_filtra_por_entidad():
    entidad = str(uuid.uuid4())

    async def _sembrar():
        for accion in ("primera", "segunda"):
            registrar_auditoria(actor_id=None, action=accion, entity_type=TIPO, entity_id=entidad)
        await esperar_auditoria()

    _ejecutar(_sembrar)

    class _Auditor:
        id = "auditor-prueba"
        role_names = ["auditor"]

    app.dependency_overrides[get_current_user] = lambda: _Auditor()
    with TestClient(app) as cliente:
        r = cliente.get("/api/v1/audit-logs", params={"entity_type": TIPO, "entity_id": entidad})
        r_filtrado = cliente.get(
            "/api/v1/audit-logs", params={"entity_id": entidad, "action": "primera", "page_size": 1}
        )

    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["total"] == 2
    assert {i["action"] for i in cuerpo["items"]} == {"primera", "segunda"}
    assert r_filtrado.json()["total"] == 1
    assert r_filtrado.json()["items"][0]["action"] == "primera"
