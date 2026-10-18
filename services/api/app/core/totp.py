"""Verificación TOTP (RFC 6238) sin dependencias externas.

El MFA es opcional: si la cuenta lo tiene activado, el login exige un código de
6 dígitos válido en la ventana actual (±1 paso por desfase de reloj).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import struct
import time


def _hotp(secret: bytes, counter: int, digits: int = 6) -> str:
    msg = struct.pack(">Q", counter)
    digest = hmac.new(secret, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(code % (10**digits)).zfill(digits)


def verificar_totp(secret_b32: str | None, code: str | None, window: int = 1, step: int = 30) -> bool:
    if not secret_b32 or not code:
        return False
    try:
        padding = "=" * ((8 - len(secret_b32) % 8) % 8)
        secret = base64.b32decode(secret_b32.upper() + padding)
    except (ValueError, TypeError):
        return False
    counter = int(time.time() // step)
    for offset in range(-window, window + 1):
        if hmac.compare_digest(_hotp(secret, counter + offset), code.strip()):
            return True
    return False


__all__ = ["verificar_totp"]
