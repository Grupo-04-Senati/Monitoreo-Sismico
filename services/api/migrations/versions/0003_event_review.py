"""Eventos sísmicos: localidad y estado de revisión.

Añade dos atributos que expone el catálogo de eventos (módulo 6.2):
`locality` (referencia textual del epicentro) y `review_status` (observado /
pendiente de validación), con sus índices de consulta.

Revision ID: 0003_event_review
Revises: 0002_sources
Create Date: 2026-10-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_event_review"
down_revision: Union[str, None] = "0002_sources"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("seismic_events", sa.Column("locality", sa.String(length=160), nullable=True))
    op.add_column(
        "seismic_events",
        sa.Column(
            "review_status",
            sa.String(length=24),
            nullable=False,
            server_default="observado",
        ),
    )
    op.create_index("ix_seismic_events_review_status", "seismic_events", ["review_status"])
    op.create_index("ix_seismic_events_depth", "seismic_events", ["depth_km"])


def downgrade() -> None:
    op.drop_index("ix_seismic_events_depth", table_name="seismic_events")
    op.drop_index("ix_seismic_events_review_status", table_name="seismic_events")
    op.drop_column("seismic_events", "review_status")
    op.drop_column("seismic_events", "locality")
