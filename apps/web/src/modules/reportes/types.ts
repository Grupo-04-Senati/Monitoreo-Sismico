import type {
  ConteoTipoEstadoReporte,
  EstadoReporte,
  EventoHistorialReporte,
  FiltrosReportes,
  FormatoReporte,
  PaginaReportes,
  ParametrosReporte,
  PeriodoReporte,
  Reporte,
  ResumenReportes,
  TipoReporte,
  TipoReporteInfo,
} from "@/types";

export type {
  ConteoTipoEstadoReporte,
  EstadoReporte,
  EventoHistorialReporte,
  FiltrosReportes,
  FormatoReporte,
  PaginaReportes,
  ParametrosReporte,
  PeriodoReporte,
  Reporte,
  ResumenReportes,
  TipoReporte,
  TipoReporteInfo,
};

/** Opción de un selector (tipo, estado, solicitante…). */
export interface OpcionFiltro {
  value: string;
  label: string;
}

/** Filtro activo mostrado como chip removible. */
export interface ChipFiltro {
  clave: string;
  etiqueta: string;
}

/** Resultado de generar las filas de un informe (reproducible). */
export interface ContenidoReporte {
  columnas: string[];
  filas: (string | number)[][];
}
