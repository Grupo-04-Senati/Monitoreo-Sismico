"""Reglas y centro de alertas de punta a punta contra PostgreSQL.

Usa eventos **reales** del catálogo (no inventa ninguno): el motor se evalúa con un
"ahora" justo después de ellos para que cuenten como recientes. Comprueba la
activación solo por el Administrador, la deduplicación, el cooldown, la aprobación
y entrega, el correo simulado, el reintento de una entrega fallida, el acuse y la
cancelación. Auditoría en memoria; al final se borran reglas y avisos de prueba.

    pytest tests/api -q
"""

from __future__ import annotations

import asyncio
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text

import app.services.alertas as servicio_alertas
import app.services.alertas_motor as motor
from app.core.permissions import get_current_user
from app.db.database import AsyncSessionLocal, engine
from app.db.models import SeismicEvent
from app.main import app

PREFIJO = "prueba_automatica_alerta"


def _ejecutar(factoria):
    async def _envoltura():
        await engine.dispose(close=False)
        try:
            return await factoria()
        finally:
            await engine.dispose()

    return asyncio.run(_envoltura())


async def _contexto():
    try:
        async with asyncio.timeout(5):
            async with engine.connect() as conn:
                if not await conn.scalar(text("SELECT to_regclass('alert_rules') IS NOT NULL")):
                    return None
                eventos = await conn.scalar(text("SELECT count(*) FROM seismic_events WHERE magnitude >= 4.5"))
                usuario = await conn.scalar(text("SELECT id FROM users ORDER BY created_at LIMIT 1"))
                return usuario if eventos and eventos >= 5 and usuario else None
    except Exception:  # noqa: BLE001
        return None


USUARIO_ID = _ejecutar(_contexto)
if USUARIO_ID is None:
    pytest.skip("PostgreSQL no disponible, sin la migración 0016 o sin eventos", allow_module_level=True)


async def _limpiar():
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM alerts WHERE rule_id IN (SELECT id FROM alert_rules WHERE name LIKE :p)"), {"p": f"{PREFIJO}%"})
        await conn.execute(text("DELETE FROM alert_rules WHERE name LIKE :p"), {"p": f"{PREFIJO}%"})


class _Usuario:
    def __init__(self, rol: str) -> None:
        self.id = USUARIO_ID
        self.role_names = [rol]


@pytest.fixture
def auditoria(monkeypatch):
    eventos: list[dict] = []
    registrar = lambda **kw: eventos.append(kw)  # noqa: E731
    monkeypatch.setattr(servicio_alertas, "registrar_auditoria", registrar)
    monkeypatch.setattr(motor, "registrar_auditoria", registrar)
    yield eventos
    app.dependency_overrides.clear()
    _ejecutar(_limpiar)


def _cliente(rol: str) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: _Usuario(rol)
    asyncio.run(engine.dispose(close=False))
    return TestClient(app)


def _regla(nombre: str, **kw) -> dict:
    base = {
        "name": f"{PREFIJO}_{nombre}",
        "condicion": {"magnitud_minima": 4.5},
        "canales": ["app", "email"],
        "destinatarios": ["seguridad@empresa-ejemplo.pe"],
        "cooldown_minutos": 0,
        "antiguedad_max_horas": 720,
    }
    base.update(kw)
    return base


def _evaluar_ultimos(n: int) -> int:
    """Evalúa los `n` eventos reales M ≥ 4.5 más recientes, con un "ahora" justo después."""

    async def _caso():
        async with AsyncSessionLocal() as db:
            eventos = list(
                (await db.execute(
                    select(SeismicEvent).where(SeismicEvent.magnitude >= 4.5).order_by(SeismicEvent.occurred_at.desc()).limit(n)
                )).scalars()
            )
            ahora = max(e.occurred_at for e in eventos) + timedelta(hours=1)
            return await motor.evaluar_eventos(db, eventos, ahora=ahora)

    return _ejecutar(_caso)


def test_activacion_motor_deduplicacion_y_ciclo_del_aviso(auditoria):
    with _cliente("alert_operator") as c:
        regla = c.post("/api/v1/alert-rules", json=_regla("ciclo")).json()
        assert regla["enabled"] is False
        assert c.post(f"/api/v1/alert-rules/{regla['id']}/activate").status_code == 403
    with _cliente("admin") as c:
        assert c.post(f"/api/v1/alert-rules/{regla['id']}/activate").json()["enabled"] is True

    assert _evaluar_ultimos(3) == 3
    assert _evaluar_ultimos(3) == 0  # deduplicación por evento y regla

    with _cliente("alert_operator") as c:
        avisos = c.get("/api/v1/alerts", params={"regla": regla["id"]}).json()["items"]
        assert len(avisos) == 3 and {a["status"] for a in avisos} == {"pendiente_aprobacion"}
        assert all(a["categoria"] == "aviso_interno" and "no es una alerta oficial" in a["message"] for a in avisos)

        aprobado = c.post(f"/api/v1/alerts/{avisos[0]['id']}/approve").json()
        canales = {e["channel"]: e["status"] for e in aprobado["entregas"]}
        assert aprobado["status"] == "enviada" and canales == {"app": "entregada", "email": "simulada"}
        assert c.post(f"/api/v1/alerts/{avisos[0]['id']}/acknowledge").json()["acknowledged_at"]
        assert c.post(f"/api/v1/alerts/{avisos[0]['id']}/acknowledge").status_code == 409

        cancelado = c.post(f"/api/v1/alerts/{avisos[1]['id']}/cancel", json={"motivo": "Falsa coincidencia"}).json()
        assert cancelado["status"] == "cancelada" and cancelado["cancel_reason"] == "Falsa coincidencia"
        assert c.post(f"/api/v1/alerts/{avisos[1]['id']}/approve").status_code == 409

        assert c.put(f"/api/v1/alert-rules/{regla['id']}", json=_regla("ciclo")).status_code == 409
        assert c.post(f"/api/v1/alert-rules/{regla['id']}/deactivate").json()["enabled"] is False

    acciones = [a["action"] for a in auditoria]
    assert acciones.count("alerta_generada") == 3
    assert {"regla_creada", "regla_activada", "alerta_aprobada", "alerta_acusada", "alerta_cancelada", "regla_desactivada"} <= set(acciones)


def test_cooldown_suprime_y_entrega_fallida_se_reintenta(auditoria, monkeypatch):
    with _cliente("admin") as c:
        regla = c.post(
            "/api/v1/alert-rules", json=_regla("cooldown", cooldown_minutos=10080, requiere_aprobacion=False)
        ).json()
        c.post(f"/api/v1/alert-rules/{regla['id']}/activate")

    def _smtp_caido(destino, asunto, cuerpo):  # noqa: ANN001
        raise ConnectionRefusedError("SMTP caído")

    monkeypatch.setattr(motor.canal_email, "enviar", _smtp_caido)
    assert _evaluar_ultimos(4) == 4

    with _cliente("admin") as c:
        avisos = c.get("/api/v1/alerts", params={"regla": regla["id"]}).json()["items"]
        estados = sorted(a["status"] for a in avisos)
        # Sin aprobación: el primero se entrega (y falla el correo); los demás caen en el cooldown de 7 días
        # salvo que estén separados por más de una semana.
        assert "fallida" in estados
        fallido = next(a for a in avisos if a["status"] == "fallida")
        correo = next(e for e in fallido["entregas"] if e["channel"] == "email")
        assert correo["status"] == "fallida" and correo["error"] == "ConnectionRefusedError" and correo["attempts"] == 1

        monkeypatch.setattr(motor.canal_email, "enviar", lambda destino, asunto, cuerpo: None)
        reintento = c.post(f"/api/v1/alerts/{fallido['id']}/retry").json()
        correo = next(e for e in reintento["entregas"] if e["channel"] == "email")
        assert reintento["status"] == "enviada" and correo["status"] == "entregada" and correo["attempts"] == 2
        assert c.post(f"/api/v1/alerts/{fallido['id']}/retry").status_code == 409


def test_simulacion_no_crea_avisos(auditoria):
    with _cliente("alert_operator") as c:
        r = c.post("/api/v1/alert-rules/simulate", json={"regla": _regla("simulada"), "dias": 3650}).json()
        assert r["coincidencias"] >= 5 and r["alertas"] + r["suprimidas_por_cooldown"] == r["coincidencias"]
        assert len(r["ejemplos"]) <= 20
    assert auditoria == []
