"""Canal SMS de los avisos internos (decisión D31), a través de Twilio.

Solo envía si están `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y `TWILIO_FROM_NUMBER`. Si no,
la entrega se registra como **simulada**: nunca se informa como enviado un SMS que no salió.
Las credenciales se leen solo del entorno y no se registran en logs ni en la base.

Usa la biblioteca estándar (`urllib`), como el conector del USGS, para no añadir
dependencias y confiar en los certificados del sistema operativo.
"""

from __future__ import annotations

import base64
import json
import urllib.error
import urllib.parse
import urllib.request

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
}


class SmsDesactivado(Exception):
    """El canal no está configurado: no se envía (entrega simulada)."""


class SmsFallido(Exception):
    """Twilio rechazó el envío; el mensaje dice por qué (sin datos sensibles)."""


def configurado() -> bool:
    return bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER)


def enviar(numero_e164: str, texto: str) -> str:
    """Envía un SMS (bloqueante: llamar con `asyncio.to_thread`). Devuelve el id de Twilio."""
    if not configurado():
        raise SmsDesactivado("SMS desactivado (sin credenciales de Twilio): no se envió.")
    datos = urllib.parse.urlencode({"To": numero_e164, "From": settings.TWILIO_FROM_NUMBER, "Body": texto}).encode()
    credencial = base64.b64encode(f"{settings.TWILIO_ACCOUNT_SID}:{settings.TWILIO_AUTH_TOKEN}".encode()).decode()
    peticion = urllib.request.Request(
        URL_TWILIO.format(sid=settings.TWILIO_ACCOUNT_SID),
        data=datos,
        headers={"Authorization": f"Basic {credencial}", "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=TIMEOUT_SEGUNDOS) as respuesta:
            return json.loads(respuesta.read().decode()).get("sid", "")
    except urllib.error.HTTPError as exc:
        try:
            cuerpo = json.loads(exc.read().decode())
        except ValueError:
            cuerpo = {}
        codigo = cuerpo.get("code")
        motivo = MOTIVOS.get(codigo) or cuerpo.get("message") or f"HTTP {exc.code}"
        raise SmsFallido(f"Twilio {codigo or exc.code}: {motivo}"[:300]) from exc
    except urllib.error.URLError as exc:
        raise SmsFallido("Twilio no respondió (sin conexión)") from exc


__all__ = ["SmsDesactivado", "SmsFallido", "configurado", "enviar", "MOTIVOS"]
