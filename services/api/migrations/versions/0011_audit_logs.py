"""Auditoría: bitácora persistente de solo inserción.

Crea `audit_logs` (PDF §7) y un trigger que rechaza UPDATE, DELETE y TRUNCATE:
el historial es inmutable (PDF §6.13). `registrar_auditoria()` mantiene su
firma y, además del log JSON, escribe aquí cada evento.

Revision ID: 0011_audit_logs
Revises: 0010_seed_roles
Create Date: 2026-10-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0011_audit_logs"
down_revision: Union[str, None] = "0010_seed_roles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("actor_id", sa.String(length=36), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=True),
        sa.Column("before_json", postgresql.JSONB(), nullable=True),
        sa.Column("after_json", postgresql.JSONB(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("correlation_id", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_audit_logs_occurred_at", "audit_logs", ["occurred_at"])
    op.create_index("ix_audit_logs_entity", "audit_logs", ["entity_type", "entity_id"])
    op.create_index("ix_audit_logs_actor", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])

    # Alembic no autogenera triggers: se crean a mano.
    op.execute(
        """
        CREATE FUNCTION audit_logs_solo_insercion() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'audit_logs es de solo insercion: % no permitido', TG_OP;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        "CREATE TRIGGER trg_audit_logs_inmutable BEFORE UPDATE OR DELETE ON audit_logs "
        "FOR EACH ROW EXECUTE FUNCTION audit_logs_solo_insercion();"
    )
    op.execute(
        "CREATE TRIGGER trg_audit_logs_sin_truncate BEFORE TRUNCATE ON audit_logs "
        "FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_solo_insercion();"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_audit_logs_sin_truncate ON audit_logs;")
    op.execute("DROP TRIGGER IF EXISTS trg_audit_logs_inmutable ON audit_logs;")
    op.execute("DROP FUNCTION IF EXISTS audit_logs_solo_insercion();")
    op.drop_table("audit_logs")
