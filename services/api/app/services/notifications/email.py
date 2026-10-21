"""Canal de correo de los avisos internos.

Solo envía si `ALERT_EMAIL_ENABLED=true` y hay un servidor SMTP configurado. Si
no, la entrega se registra como **simulada**: nunca se informa como enviada una
notificación que no salió (decisión D4: nada externo sin configurarlo y probarlo).
Las credenciales se leen solo del entorno y no se registran en logs.
"""

from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.core.config import settings


class CorreoDesactivado(Exception):
    """El canal no está configurado: no se envía (entrega simulada)."""


def configurado() -> bool:
    return bool(settings.ALERT_EMAIL_ENABLED and settings.SMTP_HOST and settings.SMTP_FROM)


def enviar(destino: str, asunto: str, cuerpo: str) -> None:
    """Envía un correo (bloqueante: llamar con `asyncio.to_thread`)."""
    if not configurado():
        raise CorreoDesactivado("Correo desactivado (ALERT_EMAIL_ENABLED=false o sin SMTP): no se envió.")
    mensaje = EmailMessage()
    mensaje["From"] = settings.SMTP_FROM
    mensaje["To"] = destino
    mensaje["Subject"] = asunto
    mensaje.set_content(cuerpo)
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
        if settings.SMTP_TLS:
            smtp.starttls()
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(mensaje)


__all__ = ["CorreoDesactivado", "configurado", "enviar"]
