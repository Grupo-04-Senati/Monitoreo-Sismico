"""Identidad: catálogo de los cinco roles del sistema.

`0001_identity` crea la tabla `roles` pero no la llena, y `crear_admin` y la
autorización dan por hecho que los roles existen. Son catálogo del sistema
(PDF §6.12, `app/core/permissions.py`), no datos de ejemplo.

Los valores se copian aquí en lugar de importarse de `permissions.py` para que
la migración no cambie si el código cambia después. Es idempotente: no duplica
roles que ya existan.

Revision ID: 0010_seed_roles
Revises: 0009_event_source_url
Create Date: 2026-10-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0010_seed_roles"
down_revision: Union[str, None] = "0009_event_source_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ROLES: tuple[tuple[str, str], ...] = (
    ("admin", "Administrador"),
    ("analyst", "Analista"),
    ("alert_operator", "Operador de alertas"),
    ("auditor", "Auditor"),
    ("viewer", "Solo lectura"),
)


def upgrade() -> None:
    insertar = sa.text(
        "INSERT INTO roles (name, label) VALUES (:name, :label) "
        "ON CONFLICT (name) DO NOTHING"
    )
    for name, label in ROLES:
        op.execute(insertar.bindparams(name=name, label=label))


def downgrade() -> None:
    # Solo se retiran si ningún usuario los tiene asignados.
    op.execute(
        sa.text(
            "DELETE FROM roles WHERE name IN :names "
            "AND id NOT IN (SELECT role_id FROM user_roles)"
        ).bindparams(sa.bindparam("names", value=[n for n, _ in ROLES], expanding=True))
    )
