"""Datos de ejemplo: marcador de muestra y recepción del evento.

- `data_sources.is_sample`: distingue la fuente de ejemplo de una fuente real
  (la interfaz muestra "Datos de ejemplo" mientras sea `true`).
- `seismic_events.received_at`: momento real de recepción reportado por la
  fuente (antes se usaba `created_at`).

Revision ID: 0005_sample_data
Revises: 0004_reports
Create Date: 2026-10-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005_sample_data"
down_revision: Union[str, None] = "0004_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "data_sources",
        sa.Column("is_sample", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "seismic_events",
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("seismic_events", "received_at")
    op.drop_column("data_sources", "is_sample")
