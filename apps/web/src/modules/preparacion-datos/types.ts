/* Tipos del módulo "Preparación de datos" (PDF §6.5). Reflejan la API
   `/api/v1/datasets` (ver `services/api/app/schemas/datasets.py`). */

export type EstadoDataset = "borrador" | "aprobado";
export type Particion = "entrenamiento" | "prueba";
export type Variable = "occurred_at" | "latitude" | "longitude" | "depth_km" | "magnitude" | "magnitude_type";
export type TipoMagnitudPermitido = "Mw" | "ML" | "mb";
export type ReglaProfundidad = "excluir" | "imputar_mediana" | "conservar";
export type ReglaDuplicados = "excluir" | "conservar";

export interface ReglasLimpieza {
  magnitud_minima: number | null;
  solo_revisados: boolean;
  tipos_magnitud: TipoMagnitudPermitido[] | null;
  sin_profundidad: ReglaProfundidad;
  posibles_duplicados: ReglaDuplicados;
}

export interface Rango {
  minimo: number | null;
  maximo: number | null;
  media: number | null;
  mediana: number | null;
}

/** Sector del dataset (D32): toda la cobertura, departamentos o radio alrededor de un activo. */
export interface ZonaDataset {
  tipo: "todo" | "departamentos" | "circulo";
  departamentos: string[];
  nombre: string | null;
  lat: number | null;
  lon: number | null;
  radio_km: number | null;
}

/** Informe de calidad que calcula el backend al crear el dataset. */
export interface InformeCalidad {
  filas_origen: number;
  filas_finales: number;
  eliminadas_por_regla: Record<string, number>;
  posibles_duplicados: { detectados: number; criterio: string };
  nulos_por_campo: Record<string, number>;
  imputacion: { metodo: string; campo?: string; valor?: number | null; filas_imputadas?: number };
  distribucion: { tipo_magnitud: Record<string, number>; estado_revision: Record<string, number> };
  magnitud: Rango;
  profundidad_km: Rango;
  cobertura_temporal: {
    primer_evento: string | null;
    ultimo_evento: string | null;
    meses: number;
    meses_sin_eventos: string[];
  };
  particion: { fecha_corte: string | null; entrenamiento: number; prueba: number };
  advertencias: string[];
  /** Ausente en datasets creados antes de D32 (= toda la cobertura). */
  zona?: { tipo: ZonaDataset["tipo"]; descripcion: string; eventos_del_periodo: number; fuera_de_zona: number };
}

export interface Dataset {
  id: string;
  name: string;
  version: number;
  description: string | null;
  status: EstadoDataset;
  source_id: string | null;
  period_start: string;
  period_end: string;
  query_spec: { fuente?: string | null; desde?: string; hasta?: string; zona?: ZonaDataset };
  cleaning_rules: ReglasLimpieza;
  variables: Variable[];
  target_name: Variable | null;
  split_date: string | null;
  row_count: number;
  quality_report: InformeCalidad;
  created_by: string;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
}

export interface PaginaDatasets {
  items: Dataset[];
  total: number;
  page: number;
  page_size: number;
}

export interface FilaDataset {
  event_id: string;
  external_id: string;
  split: Particion | null;
  occurred_at: string;
  latitude: number;
  longitude: number;
  depth_km: number | null;
  depth_imputada: boolean;
  magnitude: number | null;
  magnitude_type: string | null;
  review_status: string;
}

export interface PaginaFilas {
  items: FilaDataset[];
  total: number;
  page: number;
  page_size: number;
}

/** Cuerpo de `POST /datasets`. */
export interface NuevoDataset {
  name: string;
  description: string | null;
  fuente: string | null;
  desde: string;
  hasta: string;
  reglas: ReglasLimpieza;
  zona: ZonaDataset;
  variables: Variable[];
  variable_objetivo: Variable | null;
  fecha_corte: string | null;
}

export interface FuenteOpcion {
  key: string;
  name: string;
}
