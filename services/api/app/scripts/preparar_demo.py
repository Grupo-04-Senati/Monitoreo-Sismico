"""Prepara una demostración de la plataforma (ver docs/GUION_DEMO.md).

Subcomandos (desde ``services/api``)::

    python -m app.scripts.preparar_demo estado     # qué módulos ya tienen datos para mostrar
    python -m app.scripts.preparar_demo cuentas    # una cuenta por rol (contraseña: DEMO_PASSWORD)
    python -m app.scripts.preparar_demo avisos     # avisos de demo con las reglas activas

- ``cuentas``: crea (o restablece) cinco cuentas ``demo-<rol>@empresa-ejemplo.pe``, una
  por rol. La contraseña la elige quien prepara la demo en la variable de entorno
  ``DEMO_PASSWORD`` (nunca se pasa por parámetro). Quedan en la Auditoría.
- ``avisos``: en una demo no llegan sismos nuevos a voluntad. Este paso hace pasar los
  sismos **reales** de los últimos ``--dias`` días por las reglas **activas**, como si
  acabaran de llegar (cada uno se evalúa justo después de ocurrir). Los avisos son
  internos y quedan pendientes de aprobación, como en producción. Usar solo en demos.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import timedelta

from sqlalchemy import func, select

from app.core.clock import now as clock_now
from app.db.database import AsyncSessionLocal
from app.db.models import (
    Alert,
    AlertRule,
    Dataset,
    ModelRegistry,
    ReportJob,
    RiskEstimate,
    SeismicEvent,
    User,
)

CUENTAS = [
    ("admin", "Demo Administrador"),
    ("analyst", "Demo Analista"),
    ("alert_operator", "Demo Operador de alertas"),
    ("auditor", "Demo Auditor"),
    ("viewer", "Demo Solo lectura"),
]


def correo(rol: str) -> str:
    return f"demo-{rol.replace('_', '-')}@empresa-ejemplo.pe"


async def cuentas() -> int:
    password = os.environ.get("DEMO_PASSWORD")
    if not password:
        sys.exit("Defina DEMO_PASSWORD con la contraseña de las cuentas de demo (mín. 8, con número y símbolo).")
    from app.scripts.crear_admin import _crear

    for rol, nombre in CUENTAS:
        codigo = await _crear(argparse.Namespace(email=correo(rol), name=nombre, role=rol, force=True, password=password))
        if codigo != 0:
            return codigo
    print("\nCuentas de demo listas (todas con la contraseña de DEMO_PASSWORD):")
    for rol, nombre in CUENTAS:
        print(f"  {nombre:28} {correo(rol)}")
    return 0


async def avisos(dias: int) -> int:
    import app.services.alertas_motor as motor

    async with AsyncSessionLocal() as db:
        activas = await db.scalar(select(func.count()).select_from(AlertRule).where(AlertRule.enabled.is_(True))) or 0
        if not activas:
            print("No hay reglas activas: cree una en Reglas de alertas y actívela como Administrador.")
            return 1
        desde = clock_now() - timedelta(days=dias)
        eventos = list(
            (await db.execute(select(SeismicEvent).where(SeismicEvent.occurred_at >= desde).order_by(SeismicEvent.occurred_at))).scalars()
        )
        total = 0
        for e in eventos:
            total += await motor.evaluar_eventos(db, [e], ahora=e.occurred_at + timedelta(hours=1))
    print(f"{len(eventos)} sismos reales de los últimos {dias} días evaluados con {activas} regla(s) activa(s): {total} avisos nuevos.")
    print("Véalos en el Centro de alertas (pendientes de aprobación).")
    return 0


async def estado() -> int:
    async with AsyncSessionLocal() as db:
        async def contar(modelo, *condiciones) -> int:
            return await db.scalar(select(func.count()).select_from(modelo).where(*condiciones)) or 0

        filas = [
            ("Sismos en el catálogo", await contar(SeismicEvent), "Fuentes de datos → sincronización manual"),
            ("…con departamento", await contar(SeismicEvent, SeismicEvent.region.is_not(None)), "python -m app.scripts.asignar_regiones"),
            ("Cuentas de demo", await contar(User, User.email.like("demo-%@empresa-ejemplo.pe")), "preparar_demo cuentas"),
            ("Datasets aprobados", await contar(Dataset, Dataset.status == "aprobado"), "Preparación de datos (guion, paso 4)"),
            ("Modelos aprobados", await contar(ModelRegistry), "Modelos ML (guion, paso 5)"),
            ("Estimaciones", await contar(RiskEstimate), "Estimaciones (guion, paso 6)"),
            ("Reglas activas", await contar(AlertRule, AlertRule.enabled.is_(True)), "Reglas de alertas (guion, paso 7)"),
            ("Avisos", await contar(Alert), "preparar_demo avisos (guion, paso 8)"),
            ("Reportes", await contar(ReportJob), "Reportes (guion, paso 9)"),
        ]
    print("Estado de la demo\n")
    for nombre, n, como in filas:
        marca = "✓" if n else "·"
        print(f"  {marca} {nombre:24} {n:>6}   {'' if n else 'falta: ' + como}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepara una demostración de la plataforma.")
    sub = parser.add_subparsers(dest="accion", required=True)
    sub.add_parser("estado", help="Qué módulos ya tienen datos para mostrar.")
    sub.add_parser("cuentas", help="Una cuenta de demo por rol (contraseña en DEMO_PASSWORD).")
    p = sub.add_parser("avisos", help="Avisos de demo con las reglas activas y sismos reales recientes.")
    p.add_argument("--dias", type=int, default=30)
    args = parser.parse_args()
    if args.accion == "cuentas":
        codigo = asyncio.run(cuentas())
    elif args.accion == "avisos":
        codigo = asyncio.run(avisos(args.dias))
    else:
        codigo = asyncio.run(estado())
    sys.exit(codigo)


if __name__ == "__main__":
    main()
