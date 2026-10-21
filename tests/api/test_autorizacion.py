"""Pruebas de autorización de la API (PDF §14: "los roles bloquean funciones
tanto en la interfaz como en la API").

1. Toda ruta que no esté en la lista pública responde 401 sin sesión. Recorre
   las rutas registradas en la app, así que una ruta nueva sin protección hace
   fallar la prueba.
2. Matriz rol × endpoint de los módulos del Dueño B: el rol sin permiso recibe
   403 y el rol con permiso pasa la autorización. El usuario se simula
   sustituyendo `get_current_user`, por lo que no hace falta base de datos.

Ejecución (desde la raíz del repo):

    pytest tests/api -q
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

import pytest

# Permite importar `app` (services/api) sin empaquetarlo.
_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "services" / "api"))

from fastapi.routing import APIRoute  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.permissions import ROLES, get_current_user, permissions_for  # noqa: E402
from app.main import app  # noqa: E402

#: Rutas accesibles sin sesión (método, ruta).
PUBLICAS: set[tuple[str, str]] = {
    ("GET", "/health"),
    ("GET", "/api/v1/meta"),
    ("POST", "/api/v1/auth/login"),
    ("POST", "/api/v1/auth/register"),
    ("POST", "/api/v1/auth/refresh"),
}

#: Endpoints del Dueño B: (método, ruta, permiso o rol exigido).
#: Un valor "rol:<nombre>" exige ese rol en lugar de un permiso.
RUTAS_B: list[tuple[str, str, str]] = [
    ("GET", "/api/v1/datasets", "preparacion"),
    ("GET", "/api/v1/datasets/x/quality", "preparacion"),
    ("GET", "/api/v1/datasets/x", "preparacion"),
    ("GET", "/api/v1/datasets/x/rows", "preparacion"),
    ("POST", "/api/v1/datasets", "preparacion"),
    ("POST", "/api/v1/datasets/x/approve", "rol:admin"),
    ("GET", "/api/v1/ml/experiments", "modelos"),
    ("GET", "/api/v1/ml/experiments/x", "modelos"),
    ("POST", "/api/v1/ml/models/x/approve", "rol:admin"),
    ("GET", "/api/v1/estimates", "estimaciones"),
    ("GET", "/api/v1/alert-rules", "reglas"),
    ("GET", "/api/v1/alerts", "alertas"),
    ("POST", "/api/v1/alerts/x/approve", "alertas"),
    ("GET", "/api/v1/audit-logs", "auditoria"),
]


def _rutas_api() -> list[tuple[str, str]]:
    rutas = []
    for ruta in app.routes:
        if not isinstance(ruta, APIRoute):
            continue
        for metodo in sorted(ruta.methods - {"HEAD", "OPTIONS"}):
            rutas.append((metodo, ruta.path))
    return rutas


@dataclass
class _UsuarioSimulado:
    role_names: list[str]
    id: str = "usuario-de-prueba"


@pytest.fixture
def cliente():
    # Sin propagar errores del servidor: la matriz solo mira la autorización, y
    # un módulo que necesita la base puede responder 500 si no hay PostgreSQL.
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


def _como(rol: str) -> None:
    app.dependency_overrides[get_current_user] = lambda: _UsuarioSimulado(role_names=[rol])


@pytest.mark.parametrize(("metodo", "ruta"), _rutas_api())
def test_ruta_protegida_sin_sesion_responde_401(cliente, metodo, ruta):
    if (metodo, ruta) in PUBLICAS:
        pytest.skip("ruta pública")
    url = re.sub(r"\{[^}]+\}", "x", ruta)
    respuesta = cliente.request(metodo, url)
    assert respuesta.status_code == 401, f"{metodo} {ruta} respondió {respuesta.status_code} sin sesión"


def _tiene_acceso(rol: str, exigido: str) -> bool:
    if exigido.startswith("rol:"):
        return rol == exigido.removeprefix("rol:")
    return exigido in permissions_for(rol)


@pytest.mark.parametrize("rol", ROLES)
@pytest.mark.parametrize(("metodo", "ruta", "exigido"), RUTAS_B)
def test_matriz_roles_modulos_b(cliente, rol, metodo, ruta, exigido):
    _como(rol)
    respuesta = cliente.request(metodo, ruta)
    if _tiene_acceso(rol, exigido):
        # Pasa la autorización; lo que responda el módulo después no se evalúa aquí.
        assert respuesta.status_code not in {401, 403}, f"{rol}: {metodo} {ruta} → {respuesta.status_code}"
    else:
        assert respuesta.status_code == 403, f"{rol}: {metodo} {ruta} → {respuesta.status_code}"
