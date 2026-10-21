"""Revisiones de eventos de la fuente (PDF §6.2 y §7; decisión D27).

- `seismic_events`: `source_updated_at` (última modificación en la fuente),
  `revised_at` y `revision_count` (correcciones aplicadas). Se rellena
  `source_updated_at` desde el payload original (`properties.updated` del USGS).
- `seismic_event_revisions`: versión anterior y nueva de cada corrección. Solo
  inserción (trigger), para reconstruir los valores de un evento a una fecha.
- `ingestion_runs.records_updated`: correcciones aplicadas en cada ejecución.

Revision ID: 0018_revisiones
Revises: 0017_configuracion
Create Date: 2026-10-21
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0018_revisiones"
down_revision: Union[str, None] = "0017_configuracion"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("seismic_events", sa.Column("source_updated_at", sa.DateTime(timezone=True)))
    op.add_column("seismic_events", sa.Column("revised_at", sa.DateTime(timezone=True)))
    op.add_column("seismic_events", sa.Column("revision_count", sa.Integer(), server_default="0", nullable=False))
    op.add_column("ingestion_runs", sa.Column("records_updated", sa.Integer(), server_default="0", nullable=False))
    op.execute(
        """
        UPDATE seismic_events
        SET source_updated_at = to_timestamp((raw_payload->'properties'->>'updated')::bigint / 1000.0)
        WHERE raw_payload->'properties'->>'updated' ~ '^[0-9]+$'
        """
    )

    op.create_table(
        "seismic_event_revisions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("event_id", sa.String(36), sa.ForeignKey("seismic_events.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("revised_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("source_updated_at", sa.DateTime(timezone=True)),
        sa.Column("before_json", postgresql.JSONB(), nullable=False),
        sa.Column("after_json", postgresql.JSONB(), nullable=False),
    )
    op.create_index("ix_seismic_event_revisions_event", "seismic_event_revisions", ["event_id", "revised_at"])
    op.execute(
        """
        CREATE FUNCTION seismic_event_revisions_solo_insercion() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'seismic_event_revisions es de solo insercion: % no permitido', TG_OP;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        "CREATE TRIGGER trg_seismic_event_revisions_inmutable BEFORE UPDATE OR DELETE ON seismic_event_revisions "
        "FOR EACH ROW EXECUTE FUNCTION seismic_event_revisions_solo_insercion();"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_seismic_event_revisions_inmutable ON seismic_event_revisions;")
    op.execute("DROP FUNCTION IF EXISTS seismic_event_revisions_solo_insercion();")
    op.drop_index("ix_seismic_event_revisions_event", table_name="seismic_event_revisions")
    op.drop_table("seismic_event_revisions")
    op.drop_column("ingestion_runs", "records_updated")
    op.drop_column("seismic_events", "revision_count")
    op.drop_column("seismic_events", "revised_at")
    op.drop_column("seismic_events", "source_updated_at")
