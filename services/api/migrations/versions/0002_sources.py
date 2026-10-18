"""Fuentes de datos e ingesta: conector, ejecuciones, registro y eventos.

Revision ID: 0002_sources
Revises: 0001_identity
Create Date: 2026-10-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_sources"
down_revision: Union[str, None] = "0001_identity"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "data_sources",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("key", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("organization", sa.String(length=120), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False, server_default="API REST (JSON)"),
        sa.Column("url_api", sa.String(length=255), nullable=True),
        sa.Column("config_ref", sa.String(length=120), nullable=False, server_default="secret://sismo/fuente-api"),
        sa.Column("frequency_min", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("retries", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("timeout_sec", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("idempotent", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notify_errors", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("usage_limits", sa.String(length=255), nullable=True),
        sa.Column("license", sa.String(length=255), nullable=True),
        sa.Column("contact", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_data_sources_key", "data_sources", ["key"], unique=True)

    op.create_table(
        "seismic_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("source_id", sa.String(length=36), sa.ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("external_id", sa.String(length=64), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("depth_km", sa.Float(), nullable=True),
        sa.Column("magnitude", sa.Float(), nullable=True),
        sa.Column("magnitude_type", sa.String(length=16), nullable=True),
        sa.Column("region", sa.String(length=64), nullable=True),
        sa.Column("origin_hash", sa.String(length=64), nullable=False),
        sa.Column("raw_payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("source_id", "external_id", name="uq_seismic_events_source_external"),
        sa.CheckConstraint("latitude BETWEEN -18.6 AND 0.5", name="ck_seismic_events_latitude"),
        sa.CheckConstraint("longitude BETWEEN -81.6 AND -68.4", name="ck_seismic_events_longitude"),
        sa.CheckConstraint("depth_km IS NULL OR depth_km BETWEEN 0 AND 750", name="ck_seismic_events_depth"),
        sa.CheckConstraint("magnitude IS NULL OR magnitude BETWEEN 0 AND 10", name="ck_seismic_events_magnitude"),
    )
    op.create_index("ix_seismic_events_source_occurred", "seismic_events", ["source_id", "occurred_at"])
    op.create_index("ix_seismic_events_magnitude", "seismic_events", ["magnitude"])

    op.create_table(
        "ingestion_runs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("source_id", sa.String(length=36), sa.ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="en_curso"),
        sa.Column("triggered_by", sa.String(length=16), nullable=False, server_default="scheduled"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("records_read", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_inserted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duplicates_skipped", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("error_summary", sa.String(length=500), nullable=True),
        sa.Column("correlation_id", sa.String(length=64), nullable=True),
        sa.Column("actor_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_ingestion_runs_source_started", "ingestion_runs", ["source_id", "started_at"])
    op.create_index("ix_ingestion_runs_status", "ingestion_runs", ["status"])

    op.create_table(
        "ingestion_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("source_id", sa.String(length=36), sa.ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False),
        sa.Column("run_id", sa.String(length=36), sa.ForeignKey("ingestion_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("level", sa.String(length=8), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=False),
        sa.Column("correlation_id", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_ingestion_logs_source_ts", "ingestion_logs", ["source_id", "ts"])
    op.create_index("ix_ingestion_logs_level", "ingestion_logs", ["level"])


def downgrade() -> None:
    op.drop_index("ix_ingestion_logs_level", table_name="ingestion_logs")
    op.drop_index("ix_ingestion_logs_source_ts", table_name="ingestion_logs")
    op.drop_table("ingestion_logs")

    op.drop_index("ix_ingestion_runs_status", table_name="ingestion_runs")
    op.drop_index("ix_ingestion_runs_source_started", table_name="ingestion_runs")
    op.drop_table("ingestion_runs")

    op.drop_index("ix_seismic_events_magnitude", table_name="seismic_events")
    op.drop_index("ix_seismic_events_source_occurred", table_name="seismic_events")
    op.drop_table("seismic_events")

    op.drop_index("ix_data_sources_key", table_name="data_sources")
    op.drop_table("data_sources")
