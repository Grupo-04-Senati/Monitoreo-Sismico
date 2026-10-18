"""Reportes: trabajos de generación de informes.

Crea la tabla `report_jobs` que registra cada solicitud de informe, su estado,
sus parámetros (para reproducirlo) y el enlace temporal (con expiración) al
archivo generado.

Revision ID: 0004_reports
Revises: 0003_event_review
Create Date: 2026-10-17
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0004_reports"
down_revision: Union[str, None] = "0003_event_review"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "report_jobs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tipo", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="pendiente"),
        sa.Column("formato", sa.String(length=8), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("requested_by", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(length=120), nullable=False),
        sa.Column("corte", sa.DateTime(timezone=True), nullable=False),
        sa.Column("params", sa.JSON(), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=True),
        sa.Column("file_path", sa.String(length=255), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("error", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_report_jobs_requested_created", "report_jobs", ["requested_by", "created_at"])
    op.create_index("ix_report_jobs_status", "report_jobs", ["status"])
    op.create_index("ix_report_jobs_tipo", "report_jobs", ["tipo"])


def downgrade() -> None:
    op.drop_index("ix_report_jobs_tipo", table_name="report_jobs")
    op.drop_index("ix_report_jobs_status", table_name="report_jobs")
    op.drop_index("ix_report_jobs_requested_created", table_name="report_jobs")
    op.drop_table("report_jobs")
