"""Eventos sísmicos: enlace de procedencia por evento.

Añade `source_url` a `seismic_events` (módulo 6.2, campo "URL fuente" del §7).
Es opcional: si el proveedor no entrega un enlace por evento, la API recurre a
la URL base de la fuente; si tampoco existe, queda vacío (nunca inventado).

Revision ID: 0009_event_source_url
Revises: 0008_remove_sample
Create Date: 2026-10-18
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0009_event_source_url"
down_revision: Union[str, None] = "0008_remove_sample"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("seismic_events", sa.Column("source_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("seismic_events", "source_url")
