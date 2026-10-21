"""Fuentes: registra el catálogo del USGS como fuente de eventos.

Es la configuración de un proveedor real (PDF §6.10, decisión D15), no un dato de
ejemplo: los eventos llegan solo cuando se sincroniza. La API es pública y no
usa credencial. El administrador puede desactivarla o ajustarla desde
"Fuentes de datos". Idempotente: no duplica la fuente si ya existe.

Revision ID: 0012_fuente_usgs
Revises: 0011_audit_logs
Create Date: 2026-10-20
"""

import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0012_fuente_usgs"
down_revision: Union[str, None] = "0011_audit_logs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FUENTE = {
    "key": "usgs",
    "name": "USGS — Catálogo de sismos (ComCat)",
    "organization": "U.S. Geological Survey, Earthquake Hazards Program",
    "kind": "API REST (GeoJSON, FDSN)",
    "url_api": "https://earthquake.usgs.gov/fdsnws/event/1/query",
    "config_ref": "ninguna (API pública sin clave)",
    "usage_limits": "Hasta 20 000 eventos por consulta; uso razonable",
    "license": "Dominio público (datos del USGS)",
}


def upgrade() -> None:
    op.execute(
        sa.text(
            "INSERT INTO data_sources (id, key, name, organization, kind, url_api, config_ref, "
            "usage_limits, license) VALUES (:id, :key, :name, :organization, :kind, :url_api, "
            ":config_ref, :usage_limits, :license) ON CONFLICT (key) DO NOTHING"
        ).bindparams(id=str(uuid.uuid4()), **FUENTE)
    )


def downgrade() -> None:
    # Solo si no tiene eventos ni ejecuciones (no borra datos ingeridos).
    op.execute(
        sa.text(
            "DELETE FROM data_sources WHERE key = :key "
            "AND id NOT IN (SELECT source_id FROM seismic_events) "
            "AND id NOT IN (SELECT source_id FROM ingestion_runs)"
        ).bindparams(key=FUENTE["key"])
    )
