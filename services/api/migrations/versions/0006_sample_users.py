"""Datos de ejemplo: marcador de muestra en las cuentas.

- `users.is_sample`: distingue las cuentas del catálogo de ejemplo de las cuentas
  reales, para poder resembrar el catálogo sin tocar datos de uso real.

Revision ID: 0006_sample_users
Revises: 0005_sample_data
Create Date: 2026-10-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006_sample_users"
down_revision: Union[str, None] = "0005_sample_data"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_sample", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("users", "is_sample")
