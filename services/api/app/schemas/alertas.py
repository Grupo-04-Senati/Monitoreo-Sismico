"""Esquemas de "Reglas de alertas" (6.8) y "Centro de alertas" (6.9)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

PLANTILLA_TITULO = "Sismo M{magnitud} {tipo} · {zona}"
PLANTILLA_MENSAJE = (
    "Aviso interno ({regla}): sismo de magnitud {magnitud} {tipo}, profundidad {profundidad}, "
    "{lugar}, el {fecha}. Distancia a la zona: {distancia}. Fuente: {enlace}. "
    "Aviso operativo interno: no es una alerta oficial (consulte IGP/INDECI)."
)


class CondicionIn(BaseModel):
    magnitud_minima: float = Field(ge=0, le=10)
    profundidad_min_km: float | None = Field(default=None, ge=0, le=750)
    profundidad_max_km: float | None = Field(default=None, ge=0, le=750)
    solo_revisados: bool = False
    tipos_magnitud: list[Literal["Mw", "ML", "mb"]] | None = None

    @model_validator(mode="after")
    def _rango(self) -> "CondicionIn":
        if self.profundidad_min_km is not None and self.profundidad_max_km is not None and self.profundidad_min_km > self.profundidad_max_km:
            raise ValueError("la profundidad mínima no puede superar a la máxima")
        if self.tipos_magnitud is not None and not self.tipos_magnitud:
            raise ValueError("elija al menos un tipo de magnitud o quite el filtro")
        return self


class ZonaIn(BaseModel):
    tipo: Literal["todo", "circulo"] = "todo"
    nombre: str | None = Field(default=None, max_length=80)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    radio_km: float | None = Field(default=None, gt=0, le=2000)

    @model_validator(mode="after")
    def _circulo(self) -> "ZonaIn":
        if self.tipo == "circulo" and (self.lat is None or self.lon is None or self.radio_km is None):
            raise ValueError("una zona circular necesita latitud, longitud y radio")
        return self


class ReglaIn(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    condicion: CondicionIn
    zona: ZonaIn = Field(default_factory=ZonaIn)
    severidad: Literal["informativa", "importante", "critica"] = "importante"
    canales: list[Literal["app", "email", "sms"]] = Field(default_factory=lambda: ["app"], min_length=1)
    destinatarios: list[EmailStr] = Field(default_factory=list, max_length=20)
    #: Roles que reciben el SMS (D31): solo usuarios activos con celular verificado y consentimiento.
    roles_sms: list[Literal["admin", "analyst", "alert_operator", "auditor", "viewer"]] = Field(default_factory=list)
    cooldown_minutos: int = Field(default=60, ge=0, le=10080)
    requiere_aprobacion: bool = True
    antiguedad_max_horas: int = Field(default=24, ge=1, le=720)
    plantilla_titulo: str = Field(default=PLANTILLA_TITULO, min_length=3, max_length=200)
    plantilla_mensaje: str = Field(default=PLANTILLA_MENSAJE, min_length=3, max_length=1000)

    @model_validator(mode="after")
    def _canales(self) -> "ReglaIn":
        if len(set(self.canales)) != len(self.canales):
            raise ValueError("los canales no pueden repetirse")
        if "email" in self.canales and not self.destinatarios:
            raise ValueError("el canal de correo necesita al menos un destinatario")
        if "sms" in self.canales and not self.roles_sms:
            raise ValueError("el canal SMS necesita al menos un rol destinatario")
        return self


class ReglaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str | None
    condition_json: dict[str, Any]
    zone_spec: dict[str, Any]
    severity: str
    channels: list[str]
    recipients: list[str]
    sms_roles: list[str] = []
    cooldown_seconds: int
    requires_approval: bool
    max_event_age_hours: int
    title_template: str
    message_template: str
    enabled: bool
    created_by: str
    created_at: datetime
    updated_at: datetime
    approved_by: str | None
    approved_at: datetime | None


class ReglaListOut(BaseModel):
    items: list[ReglaOut]
    total: int


class SimulacionIn(BaseModel):
    regla: ReglaIn
    dias: int = Field(default=90, ge=1, le=3650)


class EjemploSimulacion(BaseModel):
    event_id: str
    occurred_at: datetime
    magnitude: float | None
    magnitude_type: str | None
    depth_km: float | None
    locality: str | None
    distance_km: float | None
    suprimida: bool
    titulo: str


class SimulacionOut(BaseModel):
    dias: int
    desde: datetime
    eventos_evaluados: int
    coincidencias: int
    alertas: int
    suprimidas_por_cooldown: int
    ejemplos: list[EjemploSimulacion]
    nota: str


class EntregaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    channel: str
    destination: str
    #: Para SMS: nombre y número enmascarado del destinatario (el número no se guarda en la entrega).
    destino_etiqueta: str | None = None
    status: str
    attempts: int
    last_attempt_at: datetime | None
    delivered_at: datetime | None
    error: str | None


class EventoResumenOut(BaseModel):
    id: str
    occurred_at: datetime
    magnitude: float | None
    magnitude_type: str | None
    depth_km: float | None
    locality: str | None
    latitude: float
    longitude: float


class AlertaOut(BaseModel):
    id: str
    #: Etiqueta fija: aviso operativo interno, nunca una alerta oficial.
    categoria: str = "aviso_interno"
    rule_id: str
    rule_name: str | None = None
    event_id: str
    evento: EventoResumenOut | None = None
    severity: str
    title: str
    message: str
    source_url: str | None
    distance_km: float | None
    status: str
    created_at: datetime
    approved_by: str | None
    approved_at: datetime | None
    cancelled_by: str | None
    cancelled_at: datetime | None
    cancel_reason: str | None
    acknowledged_by: str | None
    acknowledged_at: datetime | None
    entregas: list[EntregaOut] = Field(default_factory=list)


class AlertaListOut(BaseModel):
    items: list[AlertaOut]
    total: int
    page: int
    page_size: int


class CancelarIn(BaseModel):
    motivo: str = Field(min_length=3, max_length=300)
