import type { EstadoEstimacion } from "../types";

/* Etiquetas y formatos del módulo "Estimaciones experimentales". */

export const ETIQUETA_ESTADO: Record<EstadoEstimacion, string> = {
  en_revision: "En revisión",
  publicada: "Publicada",
  retirada: "Retirada",
};

export const SIMBOLO_ESTADO: Record<EstadoEstimacion, string> = {
  en_revision: "○",
  publicada: "●",
  retirada: "—",
};

/** Colores neutros: el estado de revisión no es un nivel de peligro. */
export const COLOR_ESTADO: Record<EstadoEstimacion, string> = {
  en_revision: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  publicada: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  retirada: "bg-slate-100 text-slate-500 line-through dark:bg-slate-800 dark:text-slate-400",
};

/**
 * Etiqueta de "estimación experimental": color propio (violeta) distinto de los
 * eventos observados y de cualquier alerta, como pide el PDF §13.
 */
export const CLASE_EXPERIMENTAL =
  "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";

export const ETIQUETA_ALGORITMO: Record<string, string> = {
  regresion_poisson: "Regresión de Poisson",
  regresion_lineal: "Regresión lineal",
};

/** Días UTC de la ventana: [inicio, fin) → "19 oct – 25 oct 2026". */
export function fmtVentana(inicio: string, fin: string): string {
  const f = (d: Date, conAnio: boolean) =>
    new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", ...(conAnio ? { year: "numeric" } : {}), timeZone: "UTC" }).format(d);
  const ultimoDia = new Date(new Date(fin).getTime() - 1);
  return `${f(new Date(inicio), false)} – ${f(ultimoDia, true)}`;
}

export function fmtValor(v: number | null | undefined): string {
  return v == null ? "—" : v.toLocaleString("es-PE", { maximumFractionDigits: 2 });
}
