/**
 * Fuente única de eventos sísmicos.
 *
 * El catálogo de la plataforma tiene un solo proveedor, por eso no existe un
 * filtro ni una columna de "proveedor". Estos valores se configuran por entorno
 * (`VITE_FUENTE_*`); mientras no se configure la fuente real quedan vacíos y la
 * interfaz muestra "—".
 */
const env = import.meta.env;

export const SOURCE_NAME = (env.VITE_FUENTE_NOMBRE as string | undefined) || "—";

/** Nombre completo de la organización responsable del catálogo. */
export const SOURCE_ORG = (env.VITE_FUENTE_ORG as string | undefined) || "—";

/** URL pública del proveedor (se muestra en la ficha de procedencia). */
export const SOURCE_URL = (env.VITE_FUENTE_URL as string | undefined) || "";
