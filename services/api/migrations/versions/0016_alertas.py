"""Reglas y centro de alertas (PDF §6.8, §6.9 y §7).

- `alert_rules`: condición, zona, severidad, canales, destinatarios, cooldown,
  aprobación humana, antigüedad máxima del evento y plantillas. Se crean inactivas.
- `alerts`: un aviso por evento y regla (deduplicación por restricción única).
- `alert_deliveries`: una fila por canal y destino, con intentos y error.

Revision ID: 0016_alertas
Revises: 0015_estimaciones
Create Date: 2026-10-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0016_alertas"
down_revision: Union[str, None] = "0015_estimaciones"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OBJ = sa.text("'{}'::jsonb")
_LISTA = sa.text("'[]'::jsonb")


def upgrade() -> None:
    op.create_table(
        "alert_rules",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("condition_json", postgresql.JSONB(), nullable=False, server_default=_OBJ),
        sa.Column("zone_spec", postgresql.JSONB(), nullable=False, server_default=_OBJ),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("channels", postgresql.JSONB(), nullable=False, server_default=_LISTA),
        sa.Column("recipients", postgresql.JSONB(), nullable=False, server_default=_LISTA),
        sa.Column("cooldown_seconds", sa.Integer(), nullable=False, server_default="3600"),
        sa.Column("requires_approval", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("max_event_age_hours", sa.Integer(), nullable=False, server_default="24"),
        sa.Column("title_template", sa.String(length=200), nullable=False),
        sa.Column("message_template", sa.String(length=1000), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by", sa.String(length=36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("approved_by", sa.String(length=36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("severity IN ('informativa', 'importante', 'critica')", name="ck_alert_rules_severity"),
        sa.CheckConstraint("cooldown_seconds >= 0", name="ck_alert_rules_cooldown"),
        sa.CheckConstraint("max_event_age_hours BETWEEN 1 AND 720", name="ck_alert_rules_antiguedad"),
    )

    op.create_table(
        "alerts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("rule_id", sa.String(length=36), sa.ForeignKey("alert_rules.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("event_id", sa.String(length=36), sa.ForeignKey("seismic_events.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.String(length=1200), nullable=False),
        sa.Column("source_url", sa.String(length=500), nullable=True),
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("approved_by", sa.String(length=36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_by", sa.String(length=36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_reason", sa.String(length=300), nullable=True),
        sa.Column("acknowledged_by", sa.String(length=36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("event_id", "rule_id", name="uq_alerts_event_rule"),
        sa.CheckConstraint(
            "status IN ('pendiente_aprobacion', 'aprobada', 'enviada', 'fallida', 'cancelada', 'suprimida')",
            name="ck_alerts_status",
        ),
    )
    op.create_index("ix_alerts_created_at", "alerts", ["created_at"])
    op.create_index("ix_alerts_rule_created", "alerts", ["rule_id", "created_at"])
    op.create_index("ix_alerts_status", "alerts", ["status"])

    op.create_table(
        "alert_deliveries",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("alert_id", sa.String(length=36), sa.ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel", sa.String(length=16), nullable=False),
        sa.Column("destination", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.String(length=300), nullable=True),
        sa.UniqueConstraint("alert_id", "channel", "destination", name="uq_alert_deliveries_destino"),
        sa.CheckConstraint("status IN ('entregada', 'simulada', 'fallida')", name="ck_alert_deliveries_status"),
    )


def downgrade() -> None:
    op.drop_table("alert_deliveries")
    op.drop_table("alerts")
    op.drop_table("alert_rules")
