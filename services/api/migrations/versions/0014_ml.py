"""Modelos de ML: experimentos y registro de modelos aprobados.

- `ml_experiments` (PDF §7): dataset, variables, objetivo, parámetros, semilla,
  versiones de librerías, partición, métricas y resultado (o motivo del fallo).
- `model_registry`: modelos aprobados por un Administrador, versionados por
  nombre, con sus limitaciones. Solo estos podrán publicar estimaciones.

Un experimento no se modifica después de crearse (trigger): para cambiarlo se
entrena otro.

Revision ID: 0014_ml
Revises: 0013_datasets
Create Date: 2026-10-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0014_ml"
down_revision: Union[str, None] = "0013_datasets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_JSON_OBJ = sa.text("'{}'::jsonb")
_JSON_LISTA = sa.text("'[]'::jsonb")


def upgrade() -> None:
    op.create_table(
        "ml_experiments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("task_type", sa.String(length=32), nullable=False),
        sa.Column("algorithm", sa.String(length=64), nullable=True),
        sa.Column("dataset_id", sa.String(length=36), sa.ForeignKey("datasets.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("feature_spec", postgresql.JSONB(), nullable=False, server_default=_JSON_LISTA),
        sa.Column("target_name", sa.String(length=64), nullable=True),
        sa.Column("params", postgresql.JSONB(), nullable=False, server_default=_JSON_OBJ),
        sa.Column("metrics", postgresql.JSONB(), nullable=False, server_default=_JSON_OBJ),
        sa.Column("validation_spec", postgresql.JSONB(), nullable=False, server_default=_JSON_OBJ),
        sa.Column("results", postgresql.JSONB(), nullable=False, server_default=_JSON_OBJ),
        sa.Column("warnings", postgresql.JSONB(), nullable=False, server_default=_JSON_LISTA),
        sa.Column("limitations", postgresql.JSONB(), nullable=False, server_default=_JSON_LISTA),
        sa.Column("seed", sa.Integer(), nullable=False),
        sa.Column("library_versions", postgresql.JSONB(), nullable=False, server_default=_JSON_OBJ),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("error", sa.String(length=500), nullable=True),
        sa.Column("artifact_uri", sa.String(length=255), nullable=True),
        sa.Column("created_by", sa.String(length=36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('completado', 'fallido')", name="ck_ml_experiments_status"),
    )
    op.create_index("ix_ml_experiments_created_at", "ml_experiments", ["created_at"])
    op.create_index("ix_ml_experiments_dataset", "ml_experiments", ["dataset_id"])

    op.create_table(
        "model_registry",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("experiment_id", sa.String(length=36), sa.ForeignKey("ml_experiments.id", ondelete="RESTRICT"), nullable=False, unique=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="aprobado"),
        sa.Column("approved_by", sa.String(length=36), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("limitations", sa.String(length=2000), nullable=False),
        sa.UniqueConstraint("name", "version", name="uq_model_registry_name_version"),
        sa.CheckConstraint("status IN ('aprobado', 'retirado')", name="ck_model_registry_status"),
    )

    op.execute(
        """
        CREATE FUNCTION ml_experiments_inmutable() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'ml_experiments es inmutable: % no permitido (entrene otro experimento)', TG_OP;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        "CREATE TRIGGER trg_ml_experiments_inmutable BEFORE UPDATE ON ml_experiments "
        "FOR EACH ROW EXECUTE FUNCTION ml_experiments_inmutable();"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_ml_experiments_inmutable ON ml_experiments;")
    op.execute("DROP FUNCTION IF EXISTS ml_experiments_inmutable();")
    op.drop_table("model_registry")
    op.drop_table("ml_experiments")
