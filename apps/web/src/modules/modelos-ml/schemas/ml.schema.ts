import type { EstadoExperimento, NuevoExperimento, Tarea } from "../types";

/* Etiquetas y validación del módulo "Modelos ML". */

export const TAREAS: { value: Tarea; label: string; descripcion: string }[] = [
  {
    value: "conteo_semanal",
    label: "Conteo semanal de sismos",
    descripcion:
      "Estima cuántos sismos del dataset habrá en una semana a partir de las anteriores (lineal y Poisson frente a dos referencias). Necesita fecha de corte.",
  },
  {
    value: "regresion_lineal",
    label: "Regresión lineal (didáctica)",
    descripcion:
      "Relación lineal entre las variables del dataset y su variable objetivo. Necesita fecha de corte y variable objetivo numérica.",
  },
];

export const ETIQUETA_TAREA: Record<Tarea, string> = Object.fromEntries(TAREAS.map((t) => [t.value, t.label])) as Record<Tarea, string>;

export const ETIQUETA_MODELO: Record<string, string> = {
  referencia_media: "Referencia: media histórica",
  referencia_semana_anterior: "Referencia: semana anterior",
  regresion_lineal: "Regresión lineal",
  regresion_poisson: "Regresión de Poisson",
};

export const ES_REFERENCIA = (modelo: string | null | undefined) => !!modelo && modelo.startsWith("referencia_");

export const ETIQUETA_ESTADO: Record<EstadoExperimento, string> = {
  completado: "Completado",
  fallido: "Fallido",
};

export const SIMBOLO_ESTADO: Record<EstadoExperimento, string> = {
  completado: "●",
  fallido: "✕",
};

/** Colores neutros (un experimento no es un nivel de peligro). */
export const COLOR_ESTADO: Record<EstadoExperimento, string> = {
  completado: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  fallido: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};

export const ETIQUETA_VARIABLE: Record<string, string> = {
  occurred_at: "Fecha (año decimal)",
  latitude: "Latitud",
  longitude: "Longitud",
  depth_km: "Profundidad (km)",
  magnitude: "Magnitud",
  magnitude_type: "Tipo de magnitud",
  conteo_semanal: "Conteo semanal",
  conteo_semana_menos_1: "Conteo de la semana anterior",
  conteo_semana_menos_2: "Conteo de hace 2 semanas",
  conteo_semana_menos_4: "Conteo de hace 4 semanas",
  media_ultimas_12_semanas: "Media de las 12 semanas anteriores",
  intercepto: "Intercepto",
};

export const etiquetaVariable = (v: string) => ETIQUETA_VARIABLE[v] ?? v;

/** Porcentaje con signo para la mejora frente a una referencia. */
export function fmtMejora(v: number | null | undefined): string {
  if (v == null) return "—";
  const p = (v * 100).toFixed(1);
  return `${v > 0 ? "+" : ""}${p}%`;
}

export function fmtNum(v: number | null | undefined, decimales = 3): string {
  return v == null ? "—" : v.toLocaleString("es-PE", { maximumFractionDigits: decimales });
}

export function validarFormulario(f: NuevoExperimento): string | null {
  if (f.name.trim().length < 3) return "El nombre debe tener al menos 3 caracteres.";
  if (!f.dataset_id) return "Elige un dataset aprobado.";
  if (!Number.isInteger(f.semilla) || f.semilla < 0) return "La semilla debe ser un entero positivo.";
  return null;
}
