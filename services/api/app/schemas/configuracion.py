"""Esquemas del módulo "Configuración" (PDF §6.13)."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ParametroOut(BaseModel):
    clave: str
    etiqueta: str
    descripcion: str
    grupo: str
    unidad: str
    minimo: int
    maximo: int
    defecto: int
    efecto: str
    valor: int
    personalizado: bool
    actualizado_en: datetime | None
    actualizado_por: str | None


class CorreoOut(BaseModel):
    activado: bool
    configurado: bool
    servidor: str | None
    remitente: str | None


class AccesoOut(BaseModel):
    intentos_antes_de_bloqueo: int
    bloqueo_minutos: int
    intentos_por_ip_por_minuto: int
    #: "redis" (compartido entre procesos) o "memoria" (D25).
    almacen: str = "memoria"


class SmsOut(BaseModel):
    configurado: bool
    #: "twilio" o "smsgate" (SMS Gateway for Android).
    proveedor: str = "twilio"
    #: Cuenta de prueba de Twilio: llegan sus plantillas fijas, no el texto del aviso.
    cuenta_prueba: bool = False
    #: Número emisor de Twilio o "celular Android (SMS Gateway)". Nunca una credencial.
    emisor: str | None


class SincronizacionOut(BaseModel):
    #: true: la programa la propia API (demo, D33); false: Celery beat.
    en_proceso: bool
    cada_minutos: int


class EntornoOut(BaseModel):
    """Lo que vive en `.env`: se muestra sin secretos y no se edita desde la web."""

    entorno: str
    fuentes_activas: list[str]
    origenes_cors: list[str]
    cookies_seguras: bool
    sesion_minutos: int
    correo: CorreoOut
    sms: SmsOut
    sincronizacion: SincronizacionOut
    acceso: AccesoOut
    advertencias: list[str]


class ConfiguracionOut(BaseModel):
    parametros: list[ParametroOut]
    entorno: EntornoOut


class CambioIn(BaseModel):
    valor: int = Field(ge=0, le=100_000)


class CambioOut(BaseModel):
    id: str
    accion: str
    clave: str | None
    etiqueta: str | None
    antes: dict[str, Any] | None
    despues: dict[str, Any] | None
    fecha: datetime
    actor: str | None


class RetencionOut(BaseModel):
    retencion_dias: int
    minimo_dias: int
    corte: datetime
    total: int
    a_purgar: int
    mas_antiguo: datetime | None
    borrados: int | None = None
