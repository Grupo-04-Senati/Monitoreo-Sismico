/* Tipos del módulo "Modelos de Machine Learning" (PDF §6.6). Reflejan la API
   `/api/v1/ml` (ver `services/api/app/schemas/ml.py`). */

export type Tarea = "conteo_semanal" | "regresion_lineal";
export type EstadoExperimento = "completado" | "fallido";

export interface Metricas {
  mae: number | null;
  rmse: number | null;
  r2: number | null;
  n: number;
}

export interface Experimento {
  id: string;
  name: string;
  task_type: Tarea;
  /** Modelo con menor MAE en prueba (puede ser una referencia). */
  algorithm: string | null;
  dataset_id: string;
  feature_spec: string[];
  target_name: string | null;
  params: { semilla?: number; dataset?: string };
  /** Métricas en prueba por modelo. */
  metrics: Record<string, Metricas>;
  validation_spec: Record<string, string | number | number[] | null>;
  results: {
    /** Mejora relativa del MAE: { modelo: { referencia: valor } }. */
    mejora?: Record<string, Record<string, number | null>>;
    coeficientes?: Record<string, Record<string, number>>;
    serie_prueba?: Record<string, string | number>[];
  };
  warnings: string[];
  limitations: string[];
  seed: number;
  library_versions: Record<string, string>;
  status: EstadoExperimento;
  error: string | null;
  artifact_uri: string | null;
  created_by: string;
  created_at: string;
  model_id: string | null;
}

export interface PaginaExperimentos {
  items: Experimento[];
  total: number;
  page: number;
  page_size: number;
}

export interface ModeloAprobado {
  id: string;
  experiment_id: string;
  name: string;
  version: number;
  status: string;
  task_type: Tarea;
  algorithm: string | null;
  dataset_id: string;
  metrics: Partial<Metricas>;
  approved_by: string;
  approved_at: string;
  limitations: string;
}

export interface NuevoExperimento {
  name: string;
  task_type: Tarea;
  dataset_id: string;
  semilla: number;
}

/** Dataset aprobado que se ofrece en el formulario. */
export interface DatasetOpcion {
  id: string;
  etiqueta: string;
  tieneCorte: boolean;
  tieneObjetivo: boolean;
}
