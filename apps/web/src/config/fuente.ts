/**
 * Fuente única de eventos sísmicos.
 *
 * El catálogo de la plataforma tiene un solo proveedor, por eso no existe un
 * filtro ni una columna de "proveedor": la fuente se declara aquí una sola vez.
 *
 * Nota: `SOURCE_NAME` incluye "(por validar)" porque los datos son de ejemplo.
 * Al conectar la API real, este valor debe venir del backend y no codificarse
 * en el cliente (ver `src/modules/eventos/README.md`).
 */
export const SOURCE_NAME = "IGP (por validar)";

/** Nombre completo de la organización responsable del catálogo. */
export const SOURCE_ORG = "Instituto Geofísico del Perú";

/** URL pública del proveedor (se muestra en la ficha de procedencia). */
export const SOURCE_URL = "https://www.igp.gob.pe/";
