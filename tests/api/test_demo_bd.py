"""Simulador de sismos para demostraciones (D29) y web servida por la API.

    pytest tests/api -q
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

import app.services.alertas as servicio_alertas
import app.services.alertas_motor as motor
import app.services.simulacion as simulacion
from app.core.config import settings
from app.core.permissions import get_current_user
from app.db.database import engine
from app.main import app

API = Path(__file__).resolve().parents[2] / "services" / "api"


def _ejecutar(factoria):
    async def _envoltura():
        await engine.dispose(close=False)
        try:
            return await factoria()
        finally:
            await engine.dispose()

    return asyncio.run(_envoltura())


async def _admin():
    try:
        async with asyncio.timeout(5):
            async with engine.connect() as conn:
                if not await conn.scalar(text("SELECT to_regclass('seismic_event_revisions') IS NOT NULL")):
                    return None
                return await conn.scalar(text("SELECT u.id FROM users u ORDER BY created_at LIMIT 1"))
    except Exception:  # noqa: BLE001
        return None


async def _limpiar():
    async with engine.begin() as conn:
        fuente = await conn.scalar(text("SELECT id FROM data_sources WHERE key = 'simulacion'"))
        await conn.execute(text("DELETE FROM alerts WHERE rule_id IN (SELECT id FROM alert_rules WHERE name LIKE 'prueba_demo_%')"))
        await conn.execute(text("DELETE FROM alert_rules WHERE name LIKE 'prueba_demo_%'"))
        if fuente:
            await conn.execute(text("DELETE FROM alerts WHERE event_id IN (SELECT id FROM seismic_events WHERE source_id = :f)"), {"f": fuente})
            await conn.execute(text("DELETE FROM seismic_events WHERE source_id = :f"), {"f": fuente})
            await conn.execute(text("DELETE FROM ingestion_logs WHERE run_id IN (SELECT id FROM ingestion_runs WHERE source_id = :f)"), {"f": fuente})
            await conn.execute(text("DELETE FROM ingestion_runs WHERE source_id = :f"), {"f": fuente})
            await conn.execute(text("DELETE FROM data_sources WHERE id = :f"), {"f": fuente})


class _Admin:
    def __init__(self, uid):
        self.id = uid
        self.role_names = ["admin"]


@pytest.fixture
def admin(monkeypatch):
    uid = _ejecutar(_admin)
    if uid is None:
        pytest.skip("PostgreSQL no disponible o sin migraciones/usuarios")
    for modulo in (simulacion, servicio_alertas, motor):
        monkeypatch.setattr(modulo, "registrar_auditoria", lambda **_k: None)
    app.dependency_overrides[get_current_user] = lambda: _Admin(uid)
    yield uid
    app.dependency_overrides.clear()
    _ejecutar(_limpiar)


def test_simulacion_apagada_responde_404(admin, monkeypatch):
    monkeypatch.setattr(settings, "DEMO_SIMULACION", False)
    with TestClient(app) as c:
        assert c.get("/api/v1/demo/status").json()["activo"] is False
        assert c.post("/api/v1/demo/simulate", json={"zona": "mina_arequipa", "magnitud": 5.0}).status_code == 404


def test_sismo_simulado_recorre_ingesta_y_avisos(admin, monkeypatch):
    monkeypatch.setattr(settings, "DEMO_SIMULACION", True)
    regla = {"name": "prueba_demo_arequipa", "condicion": {"magnitud_minima": 4.0},
             "zona": {"tipo": "circulo", "nombre": "Mina", "lat": -16.4, "lon": -71.5, "radio_km": 150},
             "canales": ["app"], "cooldown_minutos": 0}
    with TestClient(app) as c:
        r = c.post("/api/v1/alert-rules", json=regla).json()
        c.post(f"/api/v1/alert-rules/{r['id']}/activate")
        res = c.post("/api/v1/demo/simulate", json={"zona": "mina_arequipa", "magnitud": 5.4, "cantidad": 3}).json()
        eventos = c.get("/api/v1/events", params={"q": "SIMULADO", "page_size": 10}).json()
    assert len(res["sismos"]) == 3 and res["sismos"][0]["magnitud"] == 5.4
    assert all(s["region"] == "Arequipa" for s in res["sismos"])
    assert len(res["avisos"]) == 3 and all(a["estado"] == "pendiente_aprobacion" for a in res["avisos"])
    assert eventos["total"] >= 3 and all(e["locality"].startswith("[SIMULADO]") for e in eventos["items"])

    async def _fuente():
        async with engine.connect() as conn:
            return (await conn.execute(text("SELECT name, enabled FROM data_sources WHERE key = 'simulacion'"))).one()

    nombre, habilitada = _ejecutar(_fuente)
    assert "ficticios" in nombre and habilitada is False  # nunca se sincroniza


def test_la_api_sirve_la_web_sin_tapar_sus_rutas(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<div id=\"root\"></div>", encoding="utf-8")
    (tmp_path / "assets" / "app.js").write_text("console.log(1)", encoding="utf-8")
    codigo = (
        "from fastapi.testclient import TestClient\n"
        "from app.main import app\n"
        "c = TestClient(app)\n"
        "assert 'id=\"root\"' in c.get('/').text\n"
        "assert 'id=\"root\"' in c.get('/eventos?periodo=24h').text\n"
        "assert 'Content-Security-Policy' in c.get('/configuracion').headers\n"
        "assert c.get('/assets/app.js').text == 'console.log(1)'\n"
        "assert c.get('/health').json()['status'] == 'ok'\n"
        "r = c.get('/api/v1/no-existe')\n"
        "assert r.status_code in (401, 404) and 'root' not in r.text\n"
        "assert c.get('/api/v1/meta').headers['content-type'].startswith('application/json')\n"
        "print('ok')\n"
    )
    salida = subprocess.run(
        [sys.executable, "-c", codigo], cwd=API, capture_output=True, text=True,
        env={**os.environ, "WEB_DIST_DIR": str(tmp_path)}, timeout=120,
    )
    assert salida.returncode == 0 and "ok" in salida.stdout, salida.stderr[-1500:]
