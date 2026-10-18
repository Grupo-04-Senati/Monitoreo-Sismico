"""Datos de ejemplo: se retiran los marcadores de muestra.

- `seismic_events.is_sample`, `data_sources.is_sample` y `users.is_sample`: se
  eliminan del esquema. El proyecto queda sin la noción de "dato de ejemplo".

Revision ID: 0008_remove_sample
Revises: 0007_event_sample
Create Date: 2026-10-18
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0008_remove_sample"
down_revision: Union[str, None] = "0007_event_sample"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("seismic_events", "is_sample")
    op.drop_column("data_sources", "is_sample")
    op.drop_column("users", "is_sample")


def downgrade() -> None:
    import sqlalchemy as sa

    op.add_column(
        "users",
        sa.Column("is_sample", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "data_sources",
        sa.Column("is_sample", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "seismic_events",
        sa.Column("is_sample", sa.Boolean(), nullable=False, server_default="false"),
    )
