"""Canal SMS de los avisos internos (decisión D31), con dos proveedores a elegir (`SMS_PROVEEDOR`).

- **twilio** (por defecto): servicio en la nube. Necesita `TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN` y `TWILIO_FROM_NUMBER`. Cuenta de prueba (`TWILIO_CUENTA_PRUEBA=true`):
  Twilio solo acepta sus plantillas fijas (el cuerpo es el nombre de la plantilla) y escribe
  él el texto; el SMS llega, pero sin el contenido del aviso ni el código de verificación.
- **smsgate**: *SMS Gateway for Android* (código abierto, Apache 2.0,
  github.com/capcom6/android-sms-gateway). Un celular Android con su chip envía los SMS con
  su propio plan; Sismora deja el mensaje en el servidor del gateway (`SMSGATE_URL`, por
  defecto su nube pública) con el usuario y la clave que muestra la app. Llega el texto
  completo, desde el número peruano del celular. El celular debe estar encendido y con datos.

Sin el proveedor configurado, la entrega se registra como **simulada**: nunca se informa
como enviado un SMS que no salió. Las credenciales se leen solo del entorno y no se registran
en logs ni en la base.

Usa la biblioteca estándar (`urllib`), como el conector del USGS, para no añadir
dependencias y confiar en los certificados del sistema operativo.
"""

from __future__ import annotations

import base64
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

from app.core.config import settings

URL_TWILIO = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
TIMEOUT_SEGUNDOS = 15

#: Códigos de Twilio frecuentes, en palabras (https://www.twilio.com/docs/api/errors).
MOTIVOS = {
    21211: "número de destino inválido",
    21408: "envío a ese país no habilitado (Geo permissions de Twilio)",
    21608: "número no verificado en la cuenta de prueba de Twilio",
    21610: "el destinatario se dio de baja respondiendo STOP",
    21614: "el número no puede recibir SMS",
    572006: "la cuenta de prueba de Twilio solo acepta sus plantillas fijas (active TWILIO_CUENTA_PRUEBA o recargue la cuenta)",
}

#: Plantillas fijas de la cuenta de prueba (https://www.twilio.com/docs/usage/trials/try-out-sms).
PLANTILLA_AVISO = "sms_internal_alerts"
PLANTILLA_CODIGO = "sms_2fa"
NOTA_PRUEBA = "Cuenta de prueba de Twilio: llegó su plantilla fija, no el texto del aviso."

#: SMS Gateway: el celular toma el mensaje de una cola. Se consulta su estado unos segundos
#: para registrar si salió o falló; si sigue en cola, la entrega lo dice en su detalle.
ESPERA_ESTADO_SEG = 12
PAUSA_ESTADO_SEG = 2
ESTADOS_ENVIADO = {"Sent", "Delivered"}
ESTADOS_FALLIDO = {"Failed", "Cancelled"}
NOTA_EN_COLA = "En cola del celular (SMS Gateway): saldrá cuando el celular esté encendido y con datos."


class SmsDesactivado(Exception):
    """El canal no está configurado: no se envía (entrega simulada)."""


class SmsFallido(Exception):
    """El proveedor rechazó el envío; el mensaje dice por qué (sin datos sensibles)."""


@dataclass(frozen=True)
class Envio:
    """Resultado de un envío aceptado: id del proveedor y, si aplica, una nota para la entrega."""

    id: str
    nota: str | None = None


def proveedor() -> str:
    return "smsgate" if settings.SMS_PROVEEDOR.strip().lower() == "smsgate" else "twilio"


def configurado() -> bool:
    if proveedor() == "smsgate":
        return bool(settings.SMSGATE_URL and settings.SMSGATE_USUARIO and settings.SMSGATE_CLAVE)
    return bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER)


def cuenta_prueba() -> bool:
    """Twilio configurado con una cuenta de prueba: se envían sus plantillas fijas."""
    return proveedor() == "twilio" and configurado() and settings.TWILIO_CUENTA_PRUEBA


def emisor() -> str | None:
    """Quién envía, para la pantalla de Configuración (nunca una credencial)."""
    if not configurado():
        return None
    return "celular Android (SMS Gateway)" if proveedor() == "smsgate" else settings.TWILIO_FROM_NUMBER


def _basica(usuario: str, clave: str) -> str:
    return "Basic " + base64.b64encode(f"{usuario}:{clave}".encode()).decode()


def enviar(numero_e164: str, texto: str, plantilla: str = PLANTILLA_AVISO) -> Envio:
    """Envía un SMS (bloqueante: llamar con `asyncio.to_thread`).

    `plantilla` solo se usa con la cuenta de prueba de Twilio (no acepta otro cuerpo).
    """
    if not configurado():
        raise SmsDesactivado("SMS desactivado (proveedor sin configurar): no se envió.")
    if proveedor() == "smsgate":
        return _enviar_smsgate(numero_e164, texto)
    return _enviar_twilio(numero_e164, texto, plantilla)


# --- Twilio ---------------------------------------------------------------------------


def _enviar_twilio(numero_e164: str, texto: str, plantilla: str) -> Envio:
    cuerpo = plantilla if settings.TWILIO_CUENTA_PRUEBA else texto
    datos = urllib.parse.urlencode({"To": numero_e164, "From": settings.TWILIO_FROM_NUMBER, "Body": cuerpo}).encode()
    peticion = urllib.request.Request(
        URL_TWILIO.format(sid=settings.TWILIO_ACCOUNT_SID),
        data=datos,
        headers={
            "Authorization": _basica(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=TIMEOUT_SEGUNDOS) as respuesta:
            sid = json.loads(respuesta.read().decode()).get("sid", "")
    except urllib.error.HTTPError as exc:
        try:
            cuerpo_error = json.loads(exc.read().decode())
        except ValueError:
            cuerpo_error = {}
        codigo = cuerpo_error.get("code")
        motivo = MOTIVOS.get(codigo) or cuerpo_error.get("message") or f"HTTP {exc.code}"
        raise SmsFallido(f"Twilio {codigo or exc.code}: {motivo}"[:300]) from exc
    except urllib.error.URLError as exc:
        raise SmsFallido("Twilio no respondió (sin conexión)") from exc
    return Envio(sid, NOTA_PRUEBA if settings.TWILIO_CUENTA_PRUEBA else None)


# --- SMS Gateway for Android ----------------------------------------------------------


def _smsgate(metodo: str, ruta: str, cuerpo: dict | None = None) -> dict:
    peticion = urllib.request.Request(
        settings.SMSGATE_URL.rstrip("/") + ruta,
        data=json.dumps(cuerpo).encode() if cuerpo is not None else None,
        headers={
            "Authorization": _basica(settings.SMSGATE_USUARIO, settings.SMSGATE_CLAVE),
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method=metodo,
    )
    try:
        with urllib.request.urlopen(peticion, timeout=TIMEOUT_SEGUNDOS) as respuesta:
            datos = respuesta.read().decode()
            return json.loads(datos) if datos else {}
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            motivo = "usuario o clave de SMS Gateway incorrectos"
        else:
            try:
                motivo = json.loads(exc.read().decode()).get("message") or f"HTTP {exc.code}"
            except ValueError:
                motivo = f"HTTP {exc.code}"
        raise SmsFallido(f"SMS Gateway: {motivo}"[:300]) from exc
    except urllib.error.URLError as exc:
        raise SmsFallido("SMS Gateway no respondió (sin conexión)") from exc


def _motivo_fallo(estado: dict) -> str:
    for r in estado.get("recipients") or []:
        if r.get("error"):
            return str(r["error"])
    return str(estado.get("reason") or estado.get("error") or "el celular no pudo enviarlo")


def _enviar_smsgate(numero_e164: str, texto: str) -> Envio:
    estado = _smsgate("POST", "/messages", {"textMessage": {"text": texto}, "phoneNumbers": [numero_e164]})
    mensaje_id = str(estado.get("id") or "")
    limite = time.monotonic() + ESPERA_ESTADO_SEG
    while True:
        actual = estado.get("state")
        if actual in ESTADOS_ENVIADO:
            return Envio(mensaje_id)
        if actual in ESTADOS_FALLIDO:
            raise SmsFallido(f"SMS Gateway: {_motivo_fallo(estado)}"[:300])
        if not mensaje_id or time.monotonic() >= limite:
            return Envio(mensaje_id, NOTA_EN_COLA)
        time.sleep(PAUSA_ESTADO_SEG)
        try:
            estado = _smsgate("GET", f"/messages/{urllib.parse.quote(mensaje_id)}")
        except SmsFallido:
            return Envio(mensaje_id, NOTA_EN_COLA)  # ya quedó en cola: no se informa como fallido


__all__ = [
    "SmsDesactivado", "SmsFallido", "Envio", "proveedor", "configurado", "cuenta_prueba", "emisor", "enviar",
    "MOTIVOS", "PLANTILLA_AVISO", "PLANTILLA_CODIGO", "NOTA_PRUEBA", "NOTA_EN_COLA",
]
