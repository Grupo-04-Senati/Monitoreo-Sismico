"""Configuración (parámetros, retención) y auditoría (filtros, exportación) contra PostgreSQL.

La purga se prueba con registros de más de 11 años (retención de 3650 días), así
nunca toca auditoría real. La auditoría de las acciones se captura en memoria.
Al final se restauran los parámetros y se retiran las filas de prueba.

    pytest tests/api -q
"""

from __future__ import annotations

import asyncio
import csv
import io
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

import app.routers.auditoria as router_auditoria
import app.services.configuracion as configuracion
from app.core.permissions import get_current_user
from app.db.database import AsyncSessionLocal, engine
from app.main import app

TIPO = "prueba_automatica"


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
                if not await conn.scalar(text("SELECT to_regclass('system_settings') IS NOT NULL")):
                    return None
                return await conn.scalar(text("SELECT id FROM users ORDER BY created_at LIMIT 1"))
    except Exception:  # noqa: BLE001
        return None


USUARIO_ID = _ejecutar(_contexto)
if USUARIO_ID is None:
    pytest.skip("PostgreSQL no disponible, sin la migración 0017 o sin usuarios", allow_module_level=True)


async def _guardados():
    async with engine.connect() as conn:
        return (await conn.execute(text("SELECT key, value::text, updated_by FROM system_settings"))).all()


async def _restaurar(filas):
    async with engine.begin() as conn:
        await conn.execute(text("DELETE FROM system_settings"))
        for clave, valor, por in filas:
            await conn.execute(
                text("INSERT INTO system_settings (key, value, updated_by) VALUES (:k, CAST(:v AS jsonb), :p)"),
                {"k": clave, "v": valor, "p": por},
            )
        await conn.execute(text("ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_logs_inmutable"))
        await conn.execute(text("DELETE FROM audit_logs WHERE entity_type = :t"), {"t": TIPO})
        await conn.execute(text("ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_logs_inmutable"))


async def _insertar_auditoria(dias_atras: int, accion: str = "prueba", entidad: str | None = None) -> str:
    ident = str(uuid.uuid4())
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, occurred_at) "
                "VALUES (:i, :a, :ac, :t, :e, now() - make_interval(days => :d))"
            ),
            {"i": ident, "a": USUARIO_ID, "ac": accion, "t": TIPO, "e": entidad, "d": dias_atras},
        )
    return ident


async def _existe(ident: str) -> bool:
    async with engine.connect() as conn:
        return bool(await conn.scalar(text("SELECT count(*) FROM audit_logs WHERE id = :i"), {"i": ident}))


class _Usuario:
    def __init__(self, rol: str) -> None:
        self.id = USUARIO_ID
        self.role_names = [rol]


@pytest.fixture
def auditoria(monkeypatch):
    previos = _ejecutar(_guardados)
    eventos: list[dict] = []
    registrar = lambda **kw: eventos.append(kw)  # noqa: E731
    monkeypatch.setattr(configuracion, "registrar_auditoria", registrar)
    monkeypatch.setattr(router_auditoria, "registrar_auditoria", registrar)
    yield eventos
    app.dependency_overrides.clear()
    _ejecutar(lambda: _restaurar(previos))


def _cliente(rol: str) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: _Usuario(rol)
    asyncio.run(engine.dispose(close=False))
    return TestClient(app)


def test_parametros_validacion_y_control_de_cambios(auditoria):
    _ejecutar(lambda: _restaurar([]))  # parte de los valores por defecto
    with _cliente("admin") as c:
        datos = c.get("/api/v1/settings").json()
        claves = {p["clave"]: p for p in datos["parametros"]}
        assert claves["reportes_ttl_horas"]["valor"] == 24 and not claves["reportes_ttl_horas"]["personalizado"]
        assert "advertencias" in datos["entorno"] and "SMTP_PASSWORD" not in str(datos)
        # SMS y sincronización llegan a la pantalla (antes el esquema los descartaba).
        assert set(datos["entorno"]["sms"]) == {"configurado", "proveedor", "cuenta_prueba", "emisor"}
        assert datos["entorno"]["sincronizacion"]["cada_minutos"] >= 1

        assert c.put("/api/v1/settings/reportes_ttl_horas", json={"valor": 500}).status_code == 422
        assert c.put("/api/v1/settings/no_existe", json={"valor": 5}).status_code == 404
        assert c.put("/api/v1/settings/reportes_ttl_horas", json={"valor": 24}).status_code == 409
        cambiado = c.put("/api/v1/settings/reportes_ttl_horas", json={"valor": 48}).json()
        assert cambiado["valor"] == 48 and cambiado["personalizado"] and cambiado["actualizado_por"]
        assert c.put("/api/v1/settings/auditoria_retencion_dias", json={"valor": 100}).status_code == 422

    async def _vigente():
        async with AsyncSessionLocal() as db:
            return await configuracion.valor(db, "reportes_ttl_horas")

    assert _ejecutar(_vigente) == 48
    assert auditoria == [
        {
            "actor_id": USUARIO_ID, "action": "parametro_cambiado", "entity_type": "system_setting",
            "entity_id": "reportes_ttl_horas", "before": {"valor": 24}, "after": {"valor": 48},
            "correlation_id": auditoria[0]["correlation_id"],
        }
    ]

    _ejecutar(lambda: _insertar_auditoria(0, accion="parametro_cambiado", entidad="reportes_ttl_horas"))
    with _cliente("admin") as c:
        historial = c.get("/api/v1/settings/history").json()
        assert historial[0]["accion"] == "parametro_cambiado" and historial[0]["etiqueta"]


def test_purga_respeta_la_retencion_y_el_piso_de_la_base(auditoria):
    antiguo = _ejecutar(lambda: _insertar_auditoria(4000))
    reciente = _ejecutar(lambda: _insertar_auditoria(100))

    async def _borrar_con_bandera(ident: str):
        async with engine.begin() as conn:
            await conn.execute(text("SET LOCAL sismo.purga_auditoria = 'on'"))
            await conn.execute(text("DELETE FROM audit_logs WHERE id = :i"), {"i": ident})

    async def _borrar_sin_bandera(ident: str):
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM audit_logs WHERE id = :i"), {"i": ident})

    # La base protege lo de menos de 365 días aunque se active la purga, y todo sin ella.
    for intento in (lambda: _borrar_con_bandera(reciente), lambda: _borrar_sin_bandera(antiguo)):
        with pytest.raises(DBAPIError, match="solo insercion"):
            _ejecutar(intento)

    with _cliente("admin") as c:
        assert c.put("/api/v1/settings/auditoria_retencion_dias", json={"valor": 3650}).status_code == 200
        estado = c.get("/api/v1/settings/audit-retention").json()
        assert estado["retencion_dias"] == 3650 and estado["a_purgar"] >= 1
        resultado = c.post("/api/v1/settings/audit-retention/purge").json()
        assert resultado["borrados"] >= 1 and resultado["a_purgar"] == 0
        assert c.post("/api/v1/settings/audit-retention/purge").status_code == 409

    assert not _ejecutar(lambda: _existe(antiguo))
    assert _ejecutar(lambda: _existe(reciente))
    purga = next(a for a in auditoria if a["action"] == "auditoria_purgada")
    assert purga["after"]["borrados"] == resultado["borrados"] and purga["after"]["retencion_dias"] == 3650


def test_lista_con_nombres_filtros_y_exportacion_auditada(auditoria):
    ident = _ejecutar(lambda: _insertar_auditoria(1, accion="prueba_exportable"))
    with _cliente("auditor") as c:
        lista = c.get("/api/v1/audit-logs", params={"entity_type": TIPO}).json()
        fila = next(x for x in lista["items"] if x["id"] == ident)
        assert fila["actor_name"] and fila["actor_email"]

        facetas = c.get("/api/v1/audit-logs/facets").json()
        assert TIPO in facetas["entidades"] and "prueba_exportable" in facetas["acciones"]
        assert any(a["id"] == USUARIO_ID and a["nombre"] for a in facetas["actores"])

        r = c.get("/api/v1/audit-logs/export", params={"entity_type": TIPO, "action": "prueba_exportable"})
        assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
        filas = list(csv.reader(io.StringIO(r.content.decode("utf-8-sig"))))
        assert filas[0][:5] == ["fecha_utc", "usuario", "correo", "actor_id", "accion"] and len(filas) == 2
        assert filas[1][4] == "prueba_exportable"

    exportacion = next(a for a in auditoria if a["action"] == "auditoria_exportada")
    assert exportacion["after"]["filas"] == 1
    assert exportacion["after"]["filtros"] == {"entity_type": TIPO, "action": "prueba_exportable"}


def test_parametros_conectados_a_reportes_y_estimaciones():
    """Los módulos leen el parámetro (no una constante): el valor por defecto rige sin fila."""

    async def _caso():
        async with AsyncSessionLocal() as db:
            return [await configuracion.valor(db, c) for c in ("reportes_ttl_horas", "estimaciones_horas_datos_recientes")]

    previos = _ejecutar(_guardados)
    try:
        _ejecutar(lambda: _restaurar([]))
        assert _ejecutar(_caso) == [24, 48]
    finally:
        _ejecutar(lambda: _restaurar(previos))
