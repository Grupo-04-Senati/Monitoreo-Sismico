"""Parámetros del sistema y retención de la auditoría (PDF §6.13 y §12).

- `system_settings`: valores editables del catálogo de parámetros.
- El trigger de `audit_logs` sigue rechazando UPDATE y TRUNCATE. DELETE solo se
  permite dentro de una purga de retención explícita (`SET LOCAL
  sismo.purga_auditoria = 'on'`) y nunca para registros de menos de 365 días:
  ese piso lo impone la base, no la aplicación.

Revision ID: 0017_configuracion
Revises: 0016_alertas
Create Date: 2026-10-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0017_configuracion"
down_revision: Union[str, None] = "0016_alertas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ORIGINAL = """
CREATE OR REPLACE FUNCTION audit_logs_solo_insercion() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs es de solo insercion: % no permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;
"""

_CON_RETENCION = """
CREATE OR REPLACE FUNCTION audit_logs_solo_insercion() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND current_setting('sismo.purga_auditoria', true) = 'on'
       AND OLD.occurred_at < now() - interval '365 days' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'audit_logs es de solo insercion: % no permitido', TG_OP;
END;
$$ LANGUAGE plpgsql;
"""


def upgrade() -> None:
    op.create_table(
        "system_settings",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("value", postgresql.JSONB(), nullable=False),
        sa.Column("updated_by", sa.String(36)),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.execute(_CON_RETENCION)


def downgrade() -> None:
    op.execute(_ORIGINAL)
    op.drop_table("system_settings")
