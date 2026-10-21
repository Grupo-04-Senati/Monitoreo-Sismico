"""Estimaciones experimentales (PDF §6.7 y §7 `risk_estimates`).

Cada estimación identifica el modelo aprobado, su ventana, valor e intervalo,
método, fecha y advertencia. Trigger: los valores calculados no se modifican ni
se borran; solo cambian el estado de revisión y quién lo revisó.

Revision ID: 0015_estimaciones
Revises: 0014_ml
Create Date: 2026-10-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0015_estimaciones"
down_revision: Union[str, None] = "0014_ml"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "risk_estimates",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("model_id", sa.String(length=36), sa.ForeignKey("model_registry.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("area_code", sa.String(length=64), nullable=False),
        sa.Column("area_description", sa.String(length=255), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("window_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("metric_name", sa.String(length=64), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("lower_bound", sa.Float(), nullable=False),
        sa.Column("upper_bound", sa.Float(), nullable=False),
        sa.Column("confidence_level", sa.Float(), nullable=False),
        sa.Column("method", sa.String(length=160), nullable=False),
        sa.Column("reference_value", sa.Float(), nullable=True),
        sa.Column("inputs", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("warnings", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("disclaimer", sa.String(length=500), nullable=False),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="en_revision"),
        sa.Column("created_by", sa.String(length=36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("reviewed_by", sa.String(length=36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('en_revision', 'publicada', 'retirada')", name="ck_risk_estimates_status"),
        sa.CheckConstraint("lower_bound <= value AND value <= upper_bound", name="ck_risk_estimates_intervalo"),
        sa.CheckConstraint("window_start < window_end", name="ck_risk_estimates_ventana"),
    )
    op.create_index("ix_risk_estimates_calculated_at", "risk_estimates", ["calculated_at"])
    op.create_index("ix_risk_estimates_model", "risk_estimates", ["model_id"])

    op.execute(
        """
        CREATE FUNCTION risk_estimates_valores_fijos() RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                RAISE EXCEPTION 'risk_estimates no se borra: retire la estimacion';
            END IF;
            IF (NEW.model_id, NEW.area_code, NEW.window_start, NEW.window_end, NEW.metric_name,
                NEW.value, NEW.lower_bound, NEW.upper_bound, NEW.confidence_level, NEW.method,
                NEW.reference_value, NEW.inputs, NEW.disclaimer, NEW.calculated_at, NEW.created_by)
               IS DISTINCT FROM
               (OLD.model_id, OLD.area_code, OLD.window_start, OLD.window_end, OLD.metric_name,
                OLD.value, OLD.lower_bound, OLD.upper_bound, OLD.confidence_level, OLD.method,
                OLD.reference_value, OLD.inputs, OLD.disclaimer, OLD.calculated_at, OLD.created_by) THEN
                RAISE EXCEPTION 'risk_estimates: los valores calculados no se modifican (solo el estado de revision)';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        "CREATE TRIGGER trg_risk_estimates_valores_fijos BEFORE UPDATE OR DELETE ON risk_estimates "
        "FOR EACH ROW EXECUTE FUNCTION risk_estimates_valores_fijos();"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_risk_estimates_valores_fijos ON risk_estimates;")
    op.execute("DROP FUNCTION IF EXISTS risk_estimates_valores_fijos();")
    op.drop_table("risk_estimates")
