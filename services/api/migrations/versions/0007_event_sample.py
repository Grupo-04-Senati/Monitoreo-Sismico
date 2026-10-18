"""Datos de ejemplo: marcador de muestra en los eventos sísmicos.

- `seismic_events.is_sample`: distingue los eventos del catálogo de ejemplo de las
  observaciones reales, para poder mostrar el aviso "Datos de ejemplo" desde el
  campo de la base de datos (no desde un texto fijo del cliente).

Revision ID: 0007_event_sample
Revises: 0006_sample_users
Create Date: 2026-10-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0007_event_sample"
down_revision: Union[str, None] = "0006_sample_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "seismic_events",
        sa.Column("is_sample", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("seismic_events", "is_sample")
