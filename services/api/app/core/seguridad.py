"""Comprobaciones de seguridad al arrancar y cabeceras HTTP (PDF §12).

- `problemas_produccion`: con `ENV=production`, la API **no arranca** si quedan
  valores de desarrollo que la harían insegura (clave de sesión por defecto,
  cookies sin `Secure`, contraseña de base por defecto, CORS abierto o registro de
  SQL con secretos). Fuera de producción no bloquea nada.
- `CABECERAS`: cabeceras de seguridad para todas las respuestas; HSTS solo en
  producción (exige HTTPS).
"""

from __future__ import annotations

from app.core.config import Settings

CLAVE_DESARROLLO = "dev-secret-change-me"
PASSWORD_DB_DESARROLLO = "sismo_dev"
LARGO_MINIMO_CLAVE = 32

CABECERAS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
}
HSTS = "max-age=31536000; includeSubDomains"


def es_produccion(s: Settings) -> bool:
    return s.ENV.strip().lower() == "production"


def problemas_produccion(s: Settings) -> list[str]:
    """Motivos por los que no es seguro arrancar en producción (vacío = se puede)."""
    if not es_produccion(s):
        return []
    problemas = []
    if s.API_SECRET_KEY == CLAVE_DESARROLLO or len(s.API_SECRET_KEY) < LARGO_MINIMO_CLAVE:
        problemas.append(f"API_SECRET_KEY es la de desarrollo o tiene menos de {LARGO_MINIMO_CLAVE} caracteres.")
    if not s.COOKIE_SECURE:
        problemas.append("COOKIE_SECURE debe ser true (las cookies de sesión solo viajan por HTTPS).")
    if s.POSTGRES_PASSWORD == PASSWORD_DB_DESARROLLO:
        problemas.append("POSTGRES_PASSWORD es la contraseña de desarrollo.")
    if "*" in s.CORS_ORIGINS:
        problemas.append("CORS_ORIGINS no puede ser '*' con cookies de sesión.")
    if any("localhost" in o or "127.0.0.1" in o for o in s.CORS_ORIGINS):
        problemas.append("CORS_ORIGINS incluye localhost: use el dominio real de la aplicación.")
    if s.DB_ECHO:
        problemas.append("DB_ECHO imprime las consultas con sus valores (hashes y secretos): desactívelo.")
    return problemas


def verificar_arranque(s: Settings) -> None:
    problemas = problemas_produccion(s)
    if problemas:
        lista = "\n  - ".join(problemas)
        raise RuntimeError(f"La API no arranca en producción con esta configuración insegura:\n  - {lista}")


__all__ = ["CABECERAS", "HSTS", "es_produccion", "problemas_produccion", "verificar_arranque"]
