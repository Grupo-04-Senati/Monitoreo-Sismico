"""Preparación de datos: datasets versionados e inmutables al aprobarse.

- `datasets` (PDF §7): versión por nombre, consulta, reglas de limpieza,
  partición temporal e informe de calidad.
- `dataset_events`: instantánea de los eventos incluidos (reproducibilidad).

Triggers (Alembic no los autogenera):
- Un dataset **aprobado** no se modifica ni se borra.
- `dataset_events` no se modifica; solo se borra junto con un dataset en borrador.
- Un evento que forma parte de un dataset no se puede borrar (RESTRICT).

Revision ID: 0013_datasets
Revises: 0012_fuente_usgs
Create Date: 2026-10-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0013_datasets"
down_revision: Union[str, None] = "0012_fuente_usgs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "datasets",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="borrador"),
        sa.Column("source_id", sa.String(length=36), sa.ForeignKey("data_sources.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("query_spec", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("cleaning_rules", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("variables", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("target_name", sa.String(length=64), nullable=True),
        sa.Column("split_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("quality_report", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_by", sa.String(length=36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("approved_by", sa.String(length=36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("name", "version", name="uq_datasets_name_version"),
        sa.CheckConstraint("status IN ('borrador', 'aprobado')", name="ck_datasets_status"),
        sa.CheckConstraint("period_start <= period_end", name="ck_datasets_period"),
    )
    op.create_index("ix_datasets_created_at", "datasets", ["created_at"])

    op.create_table(
        "dataset_events",
        sa.Column("dataset_id", sa.String(length=36), sa.ForeignKey("datasets.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("event_id", sa.String(length=36), sa.ForeignKey("seismic_events.id", ondelete="RESTRICT"), primary_key=True),
        sa.Column("split", sa.String(length=16), nullable=True),
        sa.CheckConstraint("split IS NULL OR split IN ('entrenamiento', 'prueba')", name="ck_dataset_events_split"),
    )
    op.create_index("ix_dataset_events_event", "dataset_events", ["event_id"])

    op.execute(
        """
        CREATE FUNCTION datasets_aprobado_inmutable() RETURNS trigger AS $$
        BEGIN
            IF OLD.status = 'aprobado' THEN
                RAISE EXCEPTION 'dataset aprobado: % no permitido (cree una nueva version)', TG_OP;
            END IF;
            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        "CREATE TRIGGER trg_datasets_inmutable BEFORE UPDATE OR DELETE ON datasets "
        "FOR EACH ROW EXECUTE FUNCTION datasets_aprobado_inmutable();"
    )
    op.execute(
        """
        CREATE FUNCTION dataset_events_instantanea() RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'UPDATE' THEN
                RAISE EXCEPTION 'dataset_events es una instantanea: UPDATE no permitido';
            END IF;
            IF EXISTS (SELECT 1 FROM datasets WHERE id = OLD.dataset_id AND status = 'aprobado') THEN
                RAISE EXCEPTION 'dataset aprobado: no se pueden quitar eventos';
            END IF;
            RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        "CREATE TRIGGER trg_dataset_events_instantanea BEFORE UPDATE OR DELETE ON dataset_events "
        "FOR EACH ROW EXECUTE FUNCTION dataset_events_instantanea();"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_dataset_events_instantanea ON dataset_events;")
    op.execute("DROP FUNCTION IF EXISTS dataset_events_instantanea();")
    op.execute("DROP TRIGGER IF EXISTS trg_datasets_inmutable ON datasets;")
    op.execute("DROP FUNCTION IF EXISTS datasets_aprobado_inmutable();")
    op.drop_table("dataset_events")
    op.drop_table("datasets")
