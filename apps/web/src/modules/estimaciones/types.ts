/* Tipos del módulo "Estimaciones experimentales" (PDF §6.7). Reflejan la API
   `/api/v1/estimates` (ver `services/api/app/schemas/estimaciones.py`). */

export type EstadoEstimacion = "en_revision" | "publicada" | "retirada";

export interface SemanaEntrada {
  inicio: string;
  conteo: number;
}

export interface Estimacion {
  id: string;
  /** Siempre "estimacion_experimental": nunca es un evento observado ni una alerta. */
  categoria: string;
  model_id: string;
  model_name: string | null;
  model_version: number | null;
  algorithm: string | null;
  area_code: string;
  area_description: string;
  window_start: string;
  window_end: string;
  metric_name: string;
  value: number;
  lower_bound: number;
  upper_bound: number;
  confidence_level: number;
  method: string;
  reference_value: number | null;
  inputs: {
    modelo?: string;
    experimento_id?: string;
    algoritmo?: string;
    dataset_id?: string;
    semanas?: SemanaEntrada[];
    variables?: Record<string, number>;
    errores_usados?: number;
  };
  warnings: string[];
  disclaimer: string;
  calculated_at: string;
  status: EstadoEstimacion;
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface PaginaEstimaciones {
  items: Estimacion[];
  total: number;
  page: number;
  page_size: number;
  disclaimer: string;
}

/** Modelo aprobado de conteo semanal que se ofrece para estimar. */
export interface ModeloOpcion {
  id: string;
  etiqueta: string;
}
