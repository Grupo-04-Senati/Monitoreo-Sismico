"""Avisos por SMS con consentimiento (decisión D31).

- `users`: celular en E.164 (`phone_e164`), verificación (`phone_verified_at`),
  consentimiento (`sms_consent_at`) y el código pendiente (solo su hash, vencimiento,
  intentos y último envío).
- `alert_rules.sms_roles`: roles que reciben el SMS de los avisos de la regla.

Revision ID: 0019_telefono_sms
Revises: 0018_revisiones
Create Date: 2026-10-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0019_telefono_sms"
down_revision: Union[str, None] = "0018_revisiones"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone_e164", sa.String(20)))
    op.add_column("users", sa.Column("phone_verified_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("sms_consent_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("phone_code_hash", sa.String(128)))
    op.add_column("users", sa.Column("phone_code_expires_at", sa.DateTime(timezone=True)))
    op.add_column("users", sa.Column("phone_code_attempts", sa.Integer(), server_default="0", nullable=False))
    op.add_column("users", sa.Column("phone_code_sent_at", sa.DateTime(timezone=True)))
    op.add_column("alert_rules", sa.Column("sms_roles", sa.JSON(), server_default="[]", nullable=False))


def downgrade() -> None:
    op.drop_column("alert_rules", "sms_roles")
    for col in ("phone_code_sent_at", "phone_code_attempts", "phone_code_expires_at", "phone_code_hash",
                "sms_consent_at", "phone_verified_at", "phone_e164"):
        op.drop_column("users", col)
