"""configuracion base del sistema

Revision ID: 0001
Revises:
Create Date: 2026-10-15
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("description", sa.String(length=300), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("key", name=op.f("pk_system_settings")),
    )
    # Parametros iniciales (PDF 6.13: zona horaria de visualizacion; los datos siempre se guardan en UTC)
    op.execute(
        """
        INSERT INTO system_settings (key, value, description) VALUES
        ('display_timezone', '"America/Lima"', 'Zona horaria con la que se muestran las fechas; los datos se guardan en UTC')
        """
    )


def downgrade() -> None:
    op.drop_table("system_settings")
