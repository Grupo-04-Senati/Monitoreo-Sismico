import type { SeismicEvent } from "@/types";

/* ════════════════════════════════════════════════════════════════
   Tipos del módulo "Análisis estadístico".
   ════════════════════════════════════════════════════════════════ */

/** Periodo de observación; "rango" habilita fecha inicial/final. */
export type PeriodoAnalisis = "24h" | "7d" | "30d" | "rango";

/** Agrupación temporal de la serie de eventos. */
export type Agrupacion = "hora" | "dia" | "semana" | "mes";

/** Resolución (ancho de clase) del histograma de magnitud. */
export type Resolucion = 1 | 0.5;

/** Variable numérica del catálogo. */
export type VariableId = "magnitud" | "profundidad";

/** Método de correlación de la dispersión. */
export type MetodoCorrelacion = "spearman" | "pearson";

/** Cantidad de regiones a mostrar en el conteo por región. */
export type TopRegiones = 8 | 15 | 25;

/** Tipo de magnitud de la fuente, más "sin tipo" y "todos". */
export type TipoFiltro = "" | "Mw" | "ML" | "mb" | "none";

export interface FiltrosAnalisis {
  periodo: PeriodoAnalisis;
  desde: string;
  hasta: string;
  zona: string;
  magnitudMin: number | null;
  magnitudMax: number | null;
  tipo: TipoFiltro;
  profundidadMin: number | null;
  profundidadMax: number | null;
  agrupacion: Agrupacion;
  resolucion: Resolucion;
  x: VariableId;
  y: VariableId;
  metodo: MetodoCorrelacion;
  top: TopRegiones;
}

/** Claves de filtro que se pueden mostrar/ocultar por contexto. */
export type ClaveFiltro =
  | "periodo"
  | "zona"
  | "magnitud"
  | "tipo"
  | "profundidad"
  | "agrupacion"
  | "resolucion"
  | "x"
  | "y"
  | "metodo"
  | "top";

/* ── Resultados de cálculo ───────────────────────────── */

export interface PuntoGrafico {
  label: string;
  value: number;
  eventos: SeismicEvent[];
}

export interface PuntoDispersion {
  x: number;
  y: number;
  evento: SeismicEvent;
}

export interface Columna {
  clave: string;
  etiqueta: string;
  numerica?: boolean;
}

export interface Tabla {
  columnas: Columna[];
  filas: (string | number)[][];
  total: number;
  faltantes: number;
}

export interface KpiInfo {
  id: string;
  etiqueta: string;
  valor: string;
  pista: string;
  significado: string;
  calculo: string;
}

export interface ResultadoAnalisis {
  filtros: FiltrosAnalisis;
  n: number;
  faltantes: number;
  serie: { puntos: PuntoGrafico[]; mediaMovil: (number | null)[]; unidad: string; nota: string };
  magnitudes: { puntos: PuntoGrafico[] };
  profundidades: { puntos: PuntoGrafico[]; faltantes: number };
  regiones: { puntos: PuntoGrafico[] };
  dispersion: {
    puntos: PuntoDispersion[];
    xLabel: string;
    yLabel: string;
    r: number;
    n: number;
    nota: string;
  };
  resumen: Tabla;
  eventos: Tabla;
  kpis: KpiInfo[];
  etiquetaPeriodo: string;
  etiquetaFiltros: string;
}

/* ── Definición de tarjetas del módulo ───────────────── */

export type IdGrafico = "ts" | "mh" | "sc" | "rg" | "dh" | "st" | "ev";

export interface DefinicionGrafico {
  id: IdGrafico;
  titulo: string;
  subtitulo: string;
  info: string;
  filtros: ClaveFiltro[];
  ancho?: boolean;
  tipo: "barras" | "barrasH" | "dispersion" | "tabla";
}
