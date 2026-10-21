"""Caché del catálogo compacto (D26): acierto, renovación tras sincronizar, vencimiento
y límite de memoria. Sin base de datos: la "versión de los datos" se simula."""

from __future__ import annotations

import asyncio
import json

import pytest

import app.services.cache_catalogo as cache


@pytest.fixture
def version(monkeypatch):
    estado = {"v": "sync-1"}

    async def _version(_db):
        return estado["v"]

    monkeypatch.setattr(cache, "_version_datos", _version)
    cache.vaciar()
    yield estado
    cache.vaciar()


def _contador():
    llamadas = {"n": 0}

    async def calcular():
        llamadas["n"] += 1
        return {"total": llamadas["n"], "lugar": "Camaná"}

    return llamadas, calcular


def test_misma_consulta_sale_de_la_cache_y_respeta_el_formato(version):
    llamadas, calcular = _contador()
    filtros = {"mag_min": 5.0, "desde": None}
    a = asyncio.run(cache.obtener(None, filtros, calcular))
    b = asyncio.run(cache.obtener(None, {"desde": None, "mag_min": 5.0}, calcular))
    assert a == b and llamadas["n"] == 1 and cache.estadisticas == {"aciertos": 1, "fallos": 1}
    assert a == '{"total":1,"lugar":"Camaná"}'.encode("utf-8")  # igual que JSONResponse
    asyncio.run(cache.obtener(None, {"mag_min": 6.0}, calcular))
    assert llamadas["n"] == 2  # otros filtros, otra entrada


def test_una_sincronizacion_nueva_invalida_la_cache(version):
    llamadas, calcular = _contador()
    asyncio.run(cache.obtener(None, {}, calcular))
    version["v"] = "sync-2"  # terminó otra ejecución de ingesta
    cuerpo = asyncio.run(cache.obtener(None, {}, calcular))
    assert llamadas["n"] == 2 and json.loads(cuerpo)["total"] == 2


def test_vence_a_los_30_segundos(version, monkeypatch):
    llamadas, calcular = _contador()
    reloj = {"t": 1000.0}
    monkeypatch.setattr(cache.time, "monotonic", lambda: reloj["t"])
    asyncio.run(cache.obtener(None, {}, calcular))
    reloj["t"] += cache.TTL_SEG - 1
    asyncio.run(cache.obtener(None, {}, calcular))
    assert llamadas["n"] == 1
    reloj["t"] += 2
    asyncio.run(cache.obtener(None, {}, calcular))
    assert llamadas["n"] == 2


def test_no_guarda_mas_de_16_respuestas(version):
    _, calcular = _contador()
    for i in range(cache.MAX_ENTRADAS + 5):
        asyncio.run(cache.obtener(None, {"mag_min": float(i)}, calcular))
    assert len(cache._cache) == cache.MAX_ENTRADAS
