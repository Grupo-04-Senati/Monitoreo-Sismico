"""Avisos por SMS con consentimiento (D31).

1. Formato y enmascarado del número (sin base de datos).
2. Contra PostgreSQL: un usuario de Solo lectura registra su celular (con consentimiento),
   lo verifica con el código, una regla con canal SMS para su rol genera un aviso y, al
   aprobarlo, se le entrega el SMS (Twilio simulado o reemplazado); la baja lo excluye.
   Nada sale a internet: el envío a Twilio se sustituye en la prueba.

    pytest tests/api -q
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import text

import app.services.alertas as servicio_alertas
import app.services.alertas_motor as motor
import app.services.simulacion as simulacion
import app.services.telefono as telefono
from app.core.config import settings
from app.core.permissions import get_current_user
from app.db.database import engine
from app.main import app
from app.services.notifications import sms

EMAIL = f"prueba-sms-{uuid.uuid4().hex[:8]}@empresa-ejemplo.pe"


def test_normaliza_y_enmascara_el_numero():
    assert telefono.normalizar("987 654 321") == "+51987654321"
    assert telefono.normalizar("+51-987-654-321") == "+51987654321"
    assert telefono.normalizar("51987654321") == "+51987654321"
    assert telefono.normalizar("+14155550100") == "+14155550100"
    for malo in ("12345", "+51 187654321", "abc"):
        with pytest.raises(HTTPException):
            telefono.normalizar(malo)
    assert telefono.enmascarar("+51987654321") == "+51 9•• ••• 321"
    assert telefono.enmascarar(None) is None


def _ejecutar(factoria):
    async def _envoltura():
        await engine.dispose(close=False)
        try:
            return await factoria()
        finally:
            await engine.dispose()

    return asyncio.run(_envoltura())


async def _preparar():
    """Crea un usuario de Solo lectura y devuelve (id_viewer, id_admin) o None sin base."""
    try:
        async with asyncio.timeout(5):
            async with engine.begin() as conn:
                if not await conn.scalar(text("SELECT to_regclass('users') IS NOT NULL")):
                    return None
                cols = await conn.scalar(
                    text("SELECT count(*) FROM information_schema.columns WHERE table_name='users' AND column_name='phone_e164'")
                )
                admin = await conn.scalar(text("SELECT id FROM users ORDER BY created_at LIMIT 1"))
                if not cols or not admin:
                    return None
                uid = str(uuid.uuid4())
                await conn.execute(
                    text("INSERT INTO users (id, full_name, email, password_hash, status, mfa_enabled, failed_attempts) "
                         "VALUES (:i, 'Prueba SMS', :e, 'x', 'active', false, 0)"),
                    {"i": uid, "e": EMAIL},
                )
                await conn.execute(
                    text("INSERT INTO user_roles (user_id, role_id) SELECT :i, id FROM roles WHERE name = 'viewer'"), {"i": uid}
                )
                return uid, admin
    except Exception:  # noqa: BLE001
        return None


async def _limpiar():
    async with engine.begin() as conn:
        fuente = await conn.scalar(text("SELECT id FROM data_sources WHERE key = 'simulacion'"))
        await conn.execute(text("DELETE FROM alerts WHERE rule_id IN (SELECT id FROM alert_rules WHERE name LIKE 'prueba_sms_%')"))
        await conn.execute(text("DELETE FROM alert_rules WHERE name LIKE 'prueba_sms_%'"))
        if fuente:
            await conn.execute(text("DELETE FROM alerts WHERE event_id IN (SELECT id FROM seismic_events WHERE source_id = :f)"), {"f": fuente})
            await conn.execute(text("DELETE FROM seismic_events WHERE source_id = :f"), {"f": fuente})
            await conn.execute(text("DELETE FROM ingestion_logs WHERE run_id IN (SELECT id FROM ingestion_runs WHERE source_id = :f)"), {"f": fuente})
            await conn.execute(text("DELETE FROM ingestion_runs WHERE source_id = :f"), {"f": fuente})
            await conn.execute(text("DELETE FROM data_sources WHERE id = :f"), {"f": fuente})
        await conn.execute(text("DELETE FROM users WHERE email = :e"), {"e": EMAIL})


@dataclass
class _Simulado:
    id: str
    role_names: list[str]


@pytest.fixture
def usuarios(monkeypatch):
    ids = _ejecutar(_preparar)
    if ids is None:
        pytest.skip("PostgreSQL no disponible o sin la migración 0019")
    for modulo in (telefono, simulacion, servicio_alertas, motor):
        monkeypatch.setattr(modulo, "registrar_auditoria", lambda **_k: None)
    yield ids
    app.dependency_overrides.clear()
    _ejecutar(_limpiar)


def _como(uid: str, rol: str) -> None:
    app.dependency_overrides[get_current_user] = lambda: _Simulado(uid, [rol])


def test_registro_verificacion_y_entrega_por_sms(usuarios, monkeypatch):
    viewer, admin = usuarios
    monkeypatch.setattr(settings, "DEMO_SIMULACION", True)
    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "")  # sin Twilio: código y entregas simuladas
    with TestClient(app) as c:
        _como(viewer, "viewer")
        assert c.post("/api/v1/me/telefono", json={"telefono": "987654321", "consentimiento": False}).status_code == 422
        r = c.post("/api/v1/me/telefono", json={"telefono": "987 654 321", "consentimiento": True}).json()
        assert r["telefono"] == "+51 9•• ••• 321" and r["verificado"] is False and r["simulado"] is True
        codigo = r["codigo_demo"]
        otro = "000000" if codigo != "000000" else "111111"
        assert c.post("/api/v1/me/telefono/verificar", json={"codigo": otro}).status_code == 400
        assert c.post("/api/v1/me/telefono/verificar", json={"codigo": codigo}).json()["verificado"] is True
        assert c.post("/api/v1/me/telefono", json={"telefono": "987654321", "consentimiento": True}).status_code == 429

        # Regla con SMS para Solo lectura → aviso → al aprobar, SMS al usuario verificado.
        _como(admin, "admin")
        regla = {"name": "prueba_sms_arequipa", "condicion": {"magnitud_minima": 4.0},
                 "zona": {"tipo": "circulo", "nombre": "Mina", "lat": -16.4, "lon": -71.5, "radio_km": 150},
                 "canales": ["app", "sms"], "roles_sms": ["viewer"], "cooldown_minutos": 0}
        assert c.post("/api/v1/alert-rules", json={**regla, "roles_sms": []}).status_code == 422
        rid = c.post("/api/v1/alert-rules", json=regla).json()["id"]
        c.post(f"/api/v1/alert-rules/{rid}/activate")
        avisos = c.post("/api/v1/demo/simulate", json={"zona": "mina_arequipa", "magnitud": 5.5, "cantidad": 2}).json()["avisos"]  # réplica ≥ 4.3

        enviados: list[tuple[str, str]] = []
        monkeypatch.setattr(sms, "enviar", lambda numero, texto: enviados.append((numero, texto)) or "SM1")
        aprobado = c.post(f"/api/v1/alerts/{avisos[0]['id']}/approve").json()
        entregas_sms = [e for e in aprobado["entregas"] if e["channel"] == "sms"]
        assert enviados and enviados[0][0] == "+51987654321" and "No es alerta oficial" in enviados[0][1]
        assert len(entregas_sms) == 1 and entregas_sms[0]["status"] == "entregada"
        assert entregas_sms[0]["destino_etiqueta"] == "Prueba SMS (+51 9•• ••• 321)"
        assert "987654321" not in entregas_sms[0]["destination"]  # el número no se copia en la entrega

        # Baja: ya no recibe el SMS del siguiente aviso.
        _como(viewer, "viewer")
        assert c.delete("/api/v1/me/telefono").json()["telefono"] is None
        _como(admin, "admin")
        enviados.clear()
        aprobado2 = c.post(f"/api/v1/alerts/{avisos[1]['id']}/approve").json()
        assert not enviados and not [e for e in aprobado2["entregas"] if e["channel"] == "sms"]


def test_sin_twilio_la_entrega_queda_simulada(monkeypatch):
    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "")
    with pytest.raises(sms.SmsDesactivado):
        sms.enviar("+51987654321", "hola")


def test_twilio_rechaza_un_numero_no_verificado(monkeypatch):
    import io
    import urllib.error

    monkeypatch.setattr(settings, "TWILIO_ACCOUNT_SID", "AC_prueba")
    monkeypatch.setattr(settings, "TWILIO_AUTH_TOKEN", "token_prueba")
    monkeypatch.setattr(settings, "TWILIO_FROM_NUMBER", "+15550000000")

    def rechazo(*_a, **_k):
        raise urllib.error.HTTPError("https://api.twilio.com", 400, "Bad Request", {}, io.BytesIO(b'{"code": 21608, "message": "unverified"}'))

    monkeypatch.setattr(sms.urllib.request, "urlopen", rechazo)
    with pytest.raises(sms.SmsFallido, match="no verificado en la cuenta de prueba"):
        sms.enviar("+51987654321", "hola")
