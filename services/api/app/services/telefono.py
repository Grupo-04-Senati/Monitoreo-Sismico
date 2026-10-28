"""Celular de cada usuario para los avisos por SMS (decisión D31).

Reglas (Ley 29733 de protección de datos personales):
- El número lo registra **la propia persona**, con consentimiento explícito.
- Se verifica con un código de 6 dígitos enviado por SMS (se guarda solo su hash,
  vence en 10 minutos, 5 intentos, un envío por minuto).
- Solo un número verificado y con consentimiento vigente recibe avisos.
- La baja borra el número y el consentimiento. La auditoría guarda el número enmascarado.

El código se devuelve en la respuesta solo en dos casos de demostración:
- sin Twilio configurado y con `DEMO_SIMULACION=true` (el SMS se simula);
- con la cuenta de prueba de Twilio (`TWILIO_CUENTA_PRUEBA=true`): llega un SMS real, pero con
  la plantilla fija de Twilio, sin el código. Esa cuenta solo envía a números verificados en
  Twilio por su dueño, así que la titularidad del celular ya está comprobada allí.
En producción (Twilio de pago) nunca.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import re
import secrets
from datetime import timedelta

from fastapi import HTTPException, status

from app.core.clock import now as clock_now
from app.core.config import settings
from app.db.models import User
from app.services.audit import registrar_auditoria
from app.services.notifications import sms

VIGENCIA_CODIGO = timedelta(minutes=10)
ESPERA_REENVIO = timedelta(seconds=60)
MAX_INTENTOS = 5

_E164 = re.compile(r"^\+[1-9]\d{7,14}$")


def normalizar(crudo: str) -> str:
    """Formato E.164. Un celular peruano de 9 dígitos (empieza en 9) recibe el +51."""
    limpio = re.sub(r"[\s\-().]", "", crudo or "")
    if re.fullmatch(r"9\d{8}", limpio):
        limpio = "+51" + limpio
    elif re.fullmatch(r"519\d{8}", limpio):
        limpio = "+" + limpio
    if not _E164.fullmatch(limpio):
        raise HTTPException(status_code=422, detail="Número inválido: use el formato +51 9XX XXX XXX.")
    if limpio.startswith("+51") and not re.fullmatch(r"\+519\d{8}", limpio):
        raise HTTPException(status_code=422, detail="Un celular del Perú tiene 9 dígitos y empieza en 9.")
    return limpio


def enmascarar(numero: str | None) -> str | None:
    """+51987654321 → +51 9•• ••• 321 (para pantallas, exportaciones y auditoría)."""
    if not numero:
        return None
    if numero.startswith("+51") and len(numero) == 12:
        return f"+51 {numero[3]}•• ••• {numero[-3:]}"
    return f"{numero[:3]}{'•' * max(0, len(numero) - 6)}{numero[-3:]}"


def _hash(user_id: str, codigo: str) -> str:
    return hmac.new(settings.API_SECRET_KEY.encode(), f"{user_id}:{codigo}".encode(), hashlib.sha256).hexdigest()


def estado(user: User) -> dict:
    return {
        "telefono": enmascarar(user.phone_e164),
        "verificado": user.phone_verified_at is not None,
        "verificado_at": user.phone_verified_at,
        "consentimiento_at": user.sms_consent_at,
        "codigo_pendiente": user.phone_code_hash is not None and user.phone_verified_at is None,
        "sms_configurado": sms.configurado(),
        "sms_cuenta_prueba": sms.cuenta_prueba(),
    }


async def registrar(db, user: User, crudo: str, *, correlation_id: str | None) -> dict:
    """Guarda el número (sin verificar), registra el consentimiento y envía el código."""
    numero = normalizar(crudo)
    ahora = clock_now()
    if user.phone_code_sent_at and ahora - user.phone_code_sent_at < ESPERA_REENVIO:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Espere un minuto antes de pedir otro código.")
    codigo = f"{secrets.randbelow(10**6):06d}"
    user.phone_e164, user.phone_verified_at, user.sms_consent_at = numero, None, ahora
    user.phone_code_hash, user.phone_code_expires_at = _hash(user.id, codigo), ahora + VIGENCIA_CODIGO
    user.phone_code_attempts, user.phone_code_sent_at = 0, ahora

    simulado, error = False, None
    try:
        await asyncio.to_thread(
            sms.enviar, numero, f"Sismora: su código de verificación es {codigo}. Vence en 10 minutos.", sms.PLANTILLA_CODIGO
        )
    except sms.SmsDesactivado:
        simulado = True
    except sms.SmsFallido as exc:
        error = str(exc)
    await db.commit()
    registrar_auditoria(
        actor_id=user.id, action="telefono_registrado", entity_type="user", entity_id=user.id,
        after={
            "telefono": enmascarar(numero), "consentimiento": True,
            "codigo": "simulado" if simulado else ("fallido" if error else ("plantilla de prueba" if sms.cuenta_prueba() else "enviado")),
        },
        correlation_id=correlation_id,
    )
    if error:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"No se pudo enviar el código: {error}.")
    respuesta = {**estado(user), "simulado": simulado}
    if (simulado and settings.DEMO_SIMULACION) or (not simulado and sms.cuenta_prueba()):
        respuesta["codigo_demo"] = codigo  # solo demostración: el SMS no lleva el código
    return respuesta


async def verificar(db, user: User, codigo: str, *, correlation_id: str | None) -> dict:
    ahora = clock_now()
    if not user.phone_code_hash or not user.phone_code_expires_at or user.phone_verified_at:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No hay un código pendiente: registre su número.")
    if ahora > user.phone_code_expires_at:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="El código venció: pida uno nuevo.")
    if user.phone_code_attempts >= MAX_INTENTOS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Demasiados intentos: pida un código nuevo.")
    if not hmac.compare_digest(user.phone_code_hash, _hash(user.id, (codigo or "").strip())):
        user.phone_code_attempts += 1
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código incorrecto.")
    user.phone_verified_at, user.phone_code_hash, user.phone_code_expires_at = ahora, None, None
    await db.commit()
    registrar_auditoria(
        actor_id=user.id, action="telefono_verificado", entity_type="user", entity_id=user.id,
        after={"telefono": enmascarar(user.phone_e164)}, correlation_id=correlation_id,
    )
    return estado(user)


async def dar_de_baja(db, user: User, *, correlation_id: str | None) -> dict:
    antes = enmascarar(user.phone_e164)
    user.phone_e164 = user.phone_verified_at = user.sms_consent_at = None
    user.phone_code_hash = user.phone_code_expires_at = user.phone_code_sent_at = None
    user.phone_code_attempts = 0
    await db.commit()
    registrar_auditoria(
        actor_id=user.id, action="telefono_baja", entity_type="user", entity_id=user.id,
        before={"telefono": antes}, after={"telefono": None, "consentimiento": False}, correlation_id=correlation_id,
    )
    return estado(user)


__all__ = ["normalizar", "enmascarar", "estado", "registrar", "verificar", "dar_de_baja"]
