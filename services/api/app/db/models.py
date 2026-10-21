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


class AuditLog(Base):
    """Bitácora de auditoría (PDF §6.13 y §7). **Solo inserción**: un trigger en
    la base rechaza UPDATE, DELETE y TRUNCATE (migración `0011_audit_logs`).

    `actor_id` no es clave foránea a propósito: el registro debe sobrevivir
    aunque la cuenta se elimine. `before_json`/`after_json` nunca contienen
    secretos (los filtra `registrar_auditoria`).
    """

    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    actor_id: Mapped[str | None] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(64))
    before_json: Mapped[dict | None] = mapped_column(JSON)
    after_json: Mapped[dict | None] = mapped_column(JSON)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    correlation_id: Mapped[str | None] = mapped_column(String(64))

    __table_args__ = (
        Index("ix_audit_logs_occurred_at", "occurred_at"),
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
        Index("ix_audit_logs_actor", "actor_id"),
        Index("ix_audit_logs_action", "action"),
    )


# ══════════════════════════════════════════════════════════════════════════
# Preparación de datos (módulo 6.5)
# ══════════════════════════════════════════════════════════════════════════


class DatasetStatus(str):
    BORRADOR = "borrador"
    APROBADO = "aprobado"


class Dataset(Base):
    """Conjunto de datos versionado para análisis y ML (PDF §6.5 y §7).

    Congela la lista exacta de eventos (`dataset_events`), las reglas de limpieza,
    la partición temporal y el informe de calidad: un modelo entrenado sobre él es
    reproducible aunque el catálogo cambie después. Un dataset **aprobado** es
    inmutable (trigger en la migración `0013_datasets`).
    """

    __tablename__ = "datasets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=DatasetStatus.BORRADOR)

    #: Fuente y periodo consultados (fechas UTC, ambos extremos incluidos).
    source_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("data_sources.id", ondelete="RESTRICT")
    )
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    #: Consulta, reglas de limpieza e imputación aplicadas (reproducibilidad).
    query_spec: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    cleaning_rules: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    variables: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    target_name: Mapped[str | None] = mapped_column(String(64))
    #: Partición temporal: entrenamiento antes del corte, prueba desde el corte.
    split_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    quality_report: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    approved_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="RESTRICT"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("name", "version", name="uq_datasets_name_version"),
        CheckConstraint("status IN ('borrador', 'aprobado')", name="ck_datasets_status"),
        CheckConstraint("period_start <= period_end", name="ck_datasets_period"),
        Index("ix_datasets_created_at", "created_at"),
    )


class DatasetEvent(Base):
    """Evento incluido en un dataset (instantánea; solo inserción)."""

    __tablename__ = "dataset_events"

    dataset_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("datasets.id", ondelete="CASCADE"), primary_key=True
    )
    event_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("seismic_events.id", ondelete="RESTRICT"), primary_key=True
    )
    #: "entrenamiento" | "prueba" | None (sin partición).
    split: Mapped[str | None] = mapped_column(String(16))


# ══════════════════════════════════════════════════════════════════════════
# Modelos de Machine Learning (módulo 6.6)
# ══════════════════════════════════════════════════════════════════════════


class ExperimentStatus(str):
    COMPLETADO = "completado"
    FALLIDO = "fallido"


class MLExperiment(Base):
    """Experimento de ML (PDF §7 `ml_experiments`).

    Guarda todo lo necesario para reproducirlo: dataset (aprobado e inmutable),
    variables, objetivo, parámetros, semilla, versiones de librerías, partición y
    métricas en prueba. Un experimento fallido también queda, con su motivo.
    """

    __tablename__ = "ml_experiments"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    #: "conteo_semanal" | "regresion_lineal"
    task_type: Mapped[str] = mapped_column(String(32), nullable=False)
    #: Modelo con menor MAE en prueba (puede ser una referencia).
    algorithm: Mapped[str | None] = mapped_column(String(64))
    dataset_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("datasets.id", ondelete="RESTRICT"), nullable=False
    )
    feature_spec: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    target_name: Mapped[str | None] = mapped_column(String(64))
    params: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    metrics: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    validation_spec: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    #: Mejora frente a referencias, coeficientes y serie real-vs-estimada.
    results: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    warnings: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    limitations: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)
    library_versions: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    error: Mapped[str | None] = mapped_column(String(500))
    artifact_uri: Mapped[str | None] = mapped_column(String(255))
    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("status IN ('completado', 'fallido')", name="ck_ml_experiments_status"),
        Index("ix_ml_experiments_created_at", "created_at"),
        Index("ix_ml_experiments_dataset", "dataset_id"),
    )


class ModelRegistry(Base):
    """Modelo aprobado (PDF §7 `model_registry`). Solo un modelo aprobado puede
    publicar estimaciones. Se versiona por nombre de experimento."""

    __tablename__ = "model_registry"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    experiment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ml_experiments.id", ondelete="RESTRICT"), nullable=False, unique=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="aprobado")
    approved_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    #: Limitaciones visibles del modelo (PDF §8, agregado "ficha del modelo").
    limitations: Mapped[str] = mapped_column(String(2000), nullable=False)

    __table_args__ = (
        UniqueConstraint("name", "version", name="uq_model_registry_name_version"),
        CheckConstraint("status IN ('aprobado', 'retirado')", name="ck_model_registry_status"),
    )


# ══════════════════════════════════════════════════════════════════════════
# Estimaciones experimentales (módulo 6.7)
# ══════════════════════════════════════════════════════════════════════════


class EstimateStatus(str):
    EN_REVISION = "en_revision"
    PUBLICADA = "publicada"
    RETIRADA = "retirada"


class RiskEstimate(Base):
    """Estimación experimental (PDF §7 `risk_estimates`).

    Siempre identifica el modelo y su versión, lleva intervalo de incertidumbre,
    fecha de cálculo y advertencia, y **no se mezcla con eventos observados**.
    Nace "en revisión"; solo un Administrador la publica o la retira. Los valores
    calculados no se modifican (trigger en la migración `0015_estimaciones`).
    """

    __tablename__ = "risk_estimates"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    model_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("model_registry.id", ondelete="RESTRICT"), nullable=False
    )
    #: Unidad espacial: la cobertura del dataset del modelo (no hay zonas oficiales todavía).
    area_code: Mapped[str] = mapped_column(String(64), nullable=False)
    area_description: Mapped[str] = mapped_column(String(255), nullable=False)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    lower_bound: Mapped[float] = mapped_column(Float, nullable=False)
    upper_bound: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_level: Mapped[float] = mapped_column(Float, nullable=False)
    method: Mapped[str] = mapped_column(String(160), nullable=False)
    #: Valor de la referencia (media histórica) para poner la estimación en contexto.
    reference_value: Mapped[float | None] = mapped_column(Float)
    #: Conteos de las semanas previas usados como entrada (trazabilidad).
    inputs: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    warnings: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    disclaimer: Mapped[str] = mapped_column(String(500), nullable=False)
    calculated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=EstimateStatus.EN_REVISION)
    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    reviewed_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="RESTRICT"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("status IN ('en_revision', 'publicada', 'retirada')", name="ck_risk_estimates_status"),
        CheckConstraint("lower_bound <= value AND value <= upper_bound", name="ck_risk_estimates_intervalo"),
        CheckConstraint("window_start < window_end", name="ck_risk_estimates_ventana"),
        Index("ix_risk_estimates_calculated_at", "calculated_at"),
        Index("ix_risk_estimates_model", "model_id"),
    )


# ══════════════════════════════════════════════════════════════════════════
# Reglas y centro de alertas (módulos 6.8 y 6.9)
# ══════════════════════════════════════════════════════════════════════════


class AlertStatus(str):
    PENDIENTE_APROBACION = "pendiente_aprobacion"
    APROBADA = "aprobada"
    ENVIADA = "enviada"
    FALLIDA = "fallida"
    CANCELADA = "cancelada"
    #: El evento coincidió, pero la regla ya había avisado dentro de su cooldown.
    SUPRIMIDA = "suprimida"


class AlertRule(Base):
    """Regla de aviso interno (PDF §6.8 y §7 `alert_rules`).

    Se crea inactiva; solo un Administrador la activa (aprobador). `condition_json`
    y `zone_spec` se validan en `app/schemas/alertas.py`.
    """

    __tablename__ = "alert_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    condition_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    zone_spec: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    channels: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    recipients: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    cooldown_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=3600)
    requires_approval: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    #: Solo se avisa de eventos con menos de esta antigüedad (evita avisos por cargas históricas).
    max_event_age_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=24)
    title_template: Mapped[str] = mapped_column(String(200), nullable=False)
    message_template: Mapped[str] = mapped_column(String(1000), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    approved_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="RESTRICT"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("severity IN ('informativa', 'importante', 'critica')", name="ck_alert_rules_severity"),
        CheckConstraint("cooldown_seconds >= 0", name="ck_alert_rules_cooldown"),
        CheckConstraint("max_event_age_hours BETWEEN 1 AND 720", name="ck_alert_rules_antiguedad"),
    )


class Alert(Base):
    """Aviso interno generado por una regla para un evento (PDF §6.9 y §7 `alerts`).

    Uno por evento y regla (deduplicación garantizada por la base).
    """

    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    rule_id: Mapped[str] = mapped_column(String(36), ForeignKey("alert_rules.id", ondelete="RESTRICT"), nullable=False)
    event_id: Mapped[str] = mapped_column(String(36), ForeignKey("seismic_events.id", ondelete="RESTRICT"), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(String(1200), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(500))
    distance_km: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="RESTRICT"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="RESTRICT"))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_reason: Mapped[str | None] = mapped_column(String(300))
    acknowledged_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="RESTRICT"))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("event_id", "rule_id", name="uq_alerts_event_rule"),
        CheckConstraint(
            "status IN ('pendiente_aprobacion', 'aprobada', 'enviada', 'fallida', 'cancelada', 'suprimida')",
            name="ck_alerts_status",
        ),
        Index("ix_alerts_created_at", "created_at"),
        Index("ix_alerts_rule_created", "rule_id", "created_at"),
        Index("ix_alerts_status", "status"),
    )


class AlertDelivery(Base):
    """Entrega de un aviso por un canal a un destino (PDF §7 `alert_deliveries`)."""

    __tablename__ = "alert_deliveries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_id: Mapped[str] = mapped_column(String(36), ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False)
    #: "app" | "email"
    channel: Mapped[str] = mapped_column(String(16), nullable=False)
    #: "bandeja" para la app; correo del destinatario para email.
    destination: Mapped[str] = mapped_column(String(255), nullable=False)
    #: "entregada" | "simulada" (canal desactivado: no se envió) | "fallida"
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(String(300))

    __table_args__ = (
        UniqueConstraint("alert_id", "channel", "destination", name="uq_alert_deliveries_destino"),
        CheckConstraint("status IN ('entregada', 'simulada', 'fallida')", name="ck_alert_deliveries_status"),
    )

