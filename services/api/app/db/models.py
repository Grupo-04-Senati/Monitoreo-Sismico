"""Modelos SQLAlchemy del sistema.

Fase 2 incluye el modelo de identidad (usuarios, roles y su relación) que
alimenta la autenticación y el módulo "Usuarios y roles". El resto de tablas
(eventos, fuentes, reportes…) se agregan en fases posteriores con Alembic.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Table,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class UserStatus(str):
    """Estados de una cuenta. Nadie elige su rol: lo asigna un Administrador."""

    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"


#: Relación muchos-a-muchos entre usuarios y roles (una cuenta puede tener
#: más de un rol, aunque en la UI se opera con uno a la vez).
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("assigned_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
)


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))

    users: Mapped[list["User"]] = relationship(
        secondary=user_roles, back_populates="roles"
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    #: `pending` mientras espera aprobación; `active`; `suspended`.
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=UserStatus.PENDING
    )

    #: Autenticación en dos pasos (TOTP) — opcional.
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mfa_secret: Mapped[str | None] = mapped_column(String(64))

    #: Bloqueo temporal tras varios intentos fallidos.
    failed_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    approved_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    roles: Mapped[list[Role]] = relationship(
        secondary=user_roles, back_populates="users", lazy="selectin"
    )

    #: Quién aprobó la cuenta (para mostrar el nombre en la interfaz).
    approver: Mapped["User | None"] = relationship(
        "User", remote_side="User.id", foreign_keys="User.approved_by", lazy="selectin"
    )

    __table_args__ = (
        Index("ix_users_status", "status"),
    )

    @property
    def role_names(self) -> list[str]:
        return [r.name for r in self.roles]


# ══════════════════════════════════════════════════════════════════════════
# Fuentes de datos e ingesta (módulo 6.10)
# ══════════════════════════════════════════════════════════════════════════


class RunStatus(str):
    """Estados de una ejecución de ingesta (coinciden con el frontend)."""

    EN_CURSO = "en_curso"
    CORRECTA = "correcta"
    CON_ERRORES = "con_errores"
    FALLIDA = "fallida"


class DataSource(Base):
    """Conector con un proveedor de eventos sísmicos.

    En el MVP existe una sola fuente ("IGP"). Las credenciales **nunca** se
    guardan: solo se referencia un secreto externo (`config_ref`).
    """

    __tablename__ = "data_sources"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    #: Clave estable para el código ("igp").
    key: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    organization: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[str] = mapped_column(String(64), nullable=False, default="API REST (JSON)")

    url_api: Mapped[str | None] = mapped_column(String(255))
    #: Referencia a un secreto externo; el valor jamás se almacena ni se devuelve.
    config_ref: Mapped[str] = mapped_column(
        String(120), nullable=False, default="secret://sismo/fuente-api"
    )

    frequency_min: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    retries: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    timeout_sec: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    idempotent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_errors: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    #: "Por definir (Fase 0)" mientras no haya fuente real.
    usage_limits: Mapped[str | None] = mapped_column(String(255))
    license: Mapped[str | None] = mapped_column(String(255))
    contact: Mapped[str | None] = mapped_column(String(255))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    runs: Mapped[list["IngestionRun"]] = relationship(
        back_populates="source", cascade="all, delete-orphan"
    )


class IngestionRun(Base):
    """Una ejecución de la ingesta (programada o manual)."""

    __tablename__ = "ingestion_runs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    source_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False
    )

    status: Mapped[str] = mapped_column(String(16), nullable=False, default=RunStatus.EN_CURSO)
    #: "scheduled" (Celery beat) o "manual" (botón del Administrador).
    triggered_by: Mapped[str] = mapped_column(String(16), nullable=False, default="scheduled")

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    http_status: Mapped[int | None] = mapped_column(Integer)

    records_read: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    records_inserted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duplicates_skipped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    error_summary: Mapped[str | None] = mapped_column(String(500))
    correlation_id: Mapped[str | None] = mapped_column(String(64))
    actor_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))

    source: Mapped[DataSource] = relationship(back_populates="runs")
    logs: Mapped[list["IngestionLog"]] = relationship(
        back_populates="run", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_ingestion_runs_source_started", "source_id", "started_at"),
        Index("ix_ingestion_runs_status", "status"),
    )


class IngestionLog(Base):
    """Línea de registro de la ingesta. Nunca contiene secretos ni tokens."""

    __tablename__ = "ingestion_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False
    )
    run_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("ingestion_runs.id", ondelete="SET NULL")
    )

    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    level: Mapped[str] = mapped_column(String(8), nullable=False)  # INFO | WARN | ERROR
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    correlation_id: Mapped[str | None] = mapped_column(String(64))

    run: Mapped[IngestionRun | None] = relationship(back_populates="logs")

    __table_args__ = (
        Index("ix_ingestion_logs_source_ts", "source_id", "ts"),
        Index("ix_ingestion_logs_level", "level"),
    )


class SeismicEvent(Base):
    """Evento sísmico normalizado.

    La unicidad `(source_id, external_id)` garantiza la **idempotencia**: repetir
    una sincronización no crea eventos duplicados.
    """

    __tablename__ = "seismic_events"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    source_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False
    )
    external_id: Mapped[str] = mapped_column(String(64), nullable=False)

    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    #: Momento en que la fuente reportó el evento (no el de inserción).
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    depth_km: Mapped[float | None] = mapped_column(Float)
    magnitude: Mapped[float | None] = mapped_column(Float)
    magnitude_type: Mapped[str | None] = mapped_column(String(16))
    region: Mapped[str | None] = mapped_column(String(64))
    #: Referencia textual del epicentro (p. ej. "12 km al SO de Callao").
    locality: Mapped[str | None] = mapped_column(String(160))

    #: Enlace de procedencia del evento en la fuente, si el proveedor lo entrega.
    source_url: Mapped[str | None] = mapped_column(String(500))

    #: "observado" | "pendiente_validacion" (el proveedor puede revisarlos).
    review_status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="observado", server_default="observado"
    )

    #: Huella estable para auditar la deduplicación.
    origin_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    #: Payload original, para trazabilidad (nunca contiene secretos).
    raw_payload: Mapped[dict | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("source_id", "external_id", name="uq_seismic_events_source_external"),
        CheckConstraint("latitude BETWEEN -18.6 AND 0.5", name="ck_seismic_events_latitude"),
        CheckConstraint("longitude BETWEEN -81.6 AND -68.4", name="ck_seismic_events_longitude"),
        CheckConstraint("depth_km IS NULL OR depth_km BETWEEN 0 AND 750", name="ck_seismic_events_depth"),
        CheckConstraint("magnitude IS NULL OR magnitude BETWEEN 0 AND 10", name="ck_seismic_events_magnitude"),
        Index("ix_seismic_events_source_occurred", "source_id", "occurred_at"),
        Index("ix_seismic_events_magnitude", "magnitude"),
        Index("ix_seismic_events_review_status", "review_status"),
        Index("ix_seismic_events_depth", "depth_km"),
    )


# ══════════════════════════════════════════════════════════════════════════
# Reportes (módulo 6.11)
# ══════════════════════════════════════════════════════════════════════════


class ReportStatus(str):
    """Estados de un trabajo de reporte."""

    PENDIENTE = "pendiente"
    EN_PROCESO = "en_proceso"
    LISTO = "listo"
    FALLIDO = "fallido"
    EXPIRADO = "expirado"


class ReportType(str):
    """Tipos de informe. Los dos últimos dependen de proveedores externos."""

    EVENTOS = "eventos"
    CALIDAD = "calidad_datos"
    FUENTES = "fuentes_ingesta"
    MODELOS = "modelos"
    ALERTAS = "alertas"


class ReportFormat(str):
    CSV = "csv"
    XLSX = "xlsx"
    PDF = "pdf"


class ReportJob(Base):
    """Trabajo de generación de un informe.

    El archivo se guarda en un directorio temporal y su enlace **expira**
    (`expires_at`). Solo el solicitante o un Administrador pueden descargarlo.
    `params` conserva los filtros y la fecha de corte para **reproducir** el
    informe; nunca contiene secretos.
    """

    __tablename__ = "report_jobs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    tipo: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=ReportStatus.PENDIENTE, server_default="pendiente"
    )
    formato: Mapped[str] = mapped_column(String(8), nullable=False)

    #: Nombre visible del informe.
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    requested_by: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    #: Fuente/proveedor del que provienen los datos.
    source: Mapped[str] = mapped_column(String(120), nullable=False)

    #: Corte del informe (marca temporal usada como "hasta").
    corte: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    #: Filtros y parámetros usados (reproducibilidad). Nunca contiene secretos.
    params: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    row_count: Mapped[int | None] = mapped_column(Integer)
    file_path: Mapped[str | None] = mapped_column(String(255))
    file_size: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(String(500))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_report_jobs_requested_created", "requested_by", "created_at"),
        Index("ix_report_jobs_status", "status"),
        Index("ix_report_jobs_tipo", "tipo"),
    )
