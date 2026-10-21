"""Crea (o repara) una cuenta de Administrador sin depender de la interfaz.

Sirve para arrancar una base de datos vacía: el registro público deja las
cuentas en estado ``pending`` sin rol y solo un administrador puede aprobarlas,
por lo que hace falta una primera cuenta con privilegios.

Uso (desde ``services/api``, con el entorno virtual activo)::

    python -m app.scripts.crear_admin --email admin@dominio.pe

La contraseña **nunca** se pasa por parámetro (quedaría en el historial de la
consola y en la lista de procesos). El script la pide de forma interactiva; en
entornos no interactivos (CI, contenedores) la toma de la variable de entorno
``SISMO_ADMIN_PASSWORD``::

    SISMO_ADMIN_PASSWORD='...' python -m app.scripts.crear_admin --email admin@dominio.pe

Si el correo ya existe, use ``--force`` para restablecer su contraseña, estado y
rol en lugar de fallar. No crea ningún dato de ejemplo: solo la cuenta indicada.
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import os
import sys

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func, select

from app.core.security import hash_password
from app.db.database import AsyncSessionLocal
from app.db.models import Role, User, UserStatus
from app.schemas.auth import validar_password
from app.services.audit import registrar_auditoria

#: Variable de entorno usada en entornos no interactivos.
ENV_PASSWORD = "SISMO_ADMIN_PASSWORD"


def _validar_email(email: str) -> None:
    """Misma validación que el login (`EmailStr`): si el login rechaza el correo,
    la cuenta creada aquí no podría iniciar sesión (p. ej. dominios `.local`)."""
    try:
        TypeAdapter(EmailStr).validate_python(email.strip())
    except ValidationError as exc:
        motivo = exc.errors()[0].get("ctx", {}).get("reason", "formato no válido")
        raise SystemExit(f"Correo invalido: {motivo}") from exc


def _leer_password() -> str:
    """Contraseña por variable de entorno o por consola; nunca por argumento."""
    desde_entorno = os.environ.get(ENV_PASSWORD)
    if desde_entorno:
        return desde_entorno
    if not sys.stdin.isatty():
        raise SystemExit(
            f"Sin consola interactiva para pedir la contraseña. "
            f"Define la variable de entorno {ENV_PASSWORD}."
        )
    primera = getpass.getpass("Contrasena: ")
    repetir = getpass.getpass("Repite la contrasena: ")
    if primera != repetir:
        raise SystemExit("Las contrasenas no coinciden.")
    return primera


async def _crear(args: argparse.Namespace) -> int:
    email = args.email.strip().lower()
    try:
        validar_password(args.password)
    except ValueError as exc:
        raise SystemExit(f"Contrasena invalida: {exc}") from exc

    async with AsyncSessionLocal() as db:
        rol = (
            await db.execute(select(Role).where(Role.name == args.role))
        ).scalar_one_or_none()
        if rol is None:
            roles = (await db.execute(select(Role.name).order_by(Role.name))).scalars().all()
            raise SystemExit(
                f"El rol '{args.role}' no existe. Roles disponibles: {', '.join(roles) or '(ninguno)'}."
            )

        existente = (
            await db.execute(select(User).where(func.lower(User.email) == email))
        ).scalar_one_or_none()

        if existente is not None and not args.force:
            raise SystemExit(
                f"Ya existe una cuenta con {email}. Usa --force para restablecerla."
            )

        if existente is None:
            user = User(
                full_name=args.name.strip(),
                email=email,
                password_hash=hash_password(args.password),
                status=UserStatus.ACTIVE,
                mfa_enabled=False,
            )
            user.roles = [rol]
            db.add(user)
            accion = "admin_creado_por_cli"
            antes = None
        else:
            user = existente
            antes = {"status": user.status, "roles": [r.name for r in user.roles]}
            user.password_hash = hash_password(args.password)
            user.status = UserStatus.ACTIVE
            user.failed_attempts = 0
            user.locked_until = None
            if rol not in user.roles:
                user.roles = [*user.roles, rol]
            accion = "admin_restablecido_por_cli"

        await db.commit()
        await db.refresh(user)

        registrar_auditoria(
            actor_id=None,
            action=accion,
            entity_type="user",
            entity_id=user.id,
            before=antes,
            after={"email": email, "status": user.status, "roles": [r.name for r in user.roles]},
        )

        print("OK: cuenta lista.")
        print(f"  id:     {user.id}")
        print(f"  correo: {user.email}")
        print(f"  estado: {user.status}")
        print(f"  roles:  {', '.join(r.name for r in user.roles)}")
        return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.scripts.crear_admin",
        description="Crea o restablece una cuenta de administrador.",
    )
    parser.add_argument("--email", required=True, help="Correo de la cuenta.")
    parser.add_argument("--name", default="Administrador", help="Nombre completo.")
    parser.add_argument("--role", default="admin", help="Nombre del rol a asignar (por defecto: admin).")
    parser.add_argument("--force", action="store_true", help="Restablecer si el correo ya existe.")
    args = parser.parse_args(argv)
    _validar_email(args.email)
    args.password = _leer_password()
    try:
        return asyncio.run(_crear(args))
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main())
