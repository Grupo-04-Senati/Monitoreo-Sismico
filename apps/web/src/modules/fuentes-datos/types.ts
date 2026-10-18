import type {
  CalidadCampo,
  ConfiguracionFuente,
  ConectorFuente,
  EjecucionFuente,
  EstadoConector,
  EstadoEjecucion,
  FiltrosEjecuciones,
  FiltrosLogs,
  LogFuente,
  NivelLog,
  OrdenLista,
  PaginaEjecuciones,
  PaginaLogs,
  ResumenFuente,
  TabFuente,
} from "@/types";

export type {
  CalidadCampo,
  ConfiguracionFuente,
  ConectorFuente,
  EjecucionFuente,
  EstadoConector,
  EstadoEjecucion,
  FiltrosEjecuciones,
  FiltrosLogs,
  LogFuente,
  NivelLog,
  OrdenLista,
  PaginaEjecuciones,
  PaginaLogs,
  ResumenFuente,
  TabFuente,
};

/** Opción de un selector (periodo, estado, nivel…). */
export interface OpcionFiltro {
  value: string;
  label: string;
}

/** Filtro activo mostrado como chip removible. */
export interface ChipFiltro {
  clave: string;
  etiqueta: string;
}
