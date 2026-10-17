import type {
  CampoOrdenEventos,
  EventoSismico,
  EstadoRevision,
  FiltrosEventos,
  OrdenEventos,
  PaginaEventos,
  RangoProfundidad,
  ResumenEventos,
} from "@/types";

export type {
  CampoOrdenEventos,
  EventoSismico,
  EstadoRevision,
  FiltrosEventos,
  OrdenEventos,
  PaginaEventos,
  RangoProfundidad,
  ResumenEventos,
};

/** Opción de la barra de filtros (periodo, estado…). */
export interface OpcionFiltro {
  value: string;
  label: string;
}

/** Filtro activo mostrado como chip removible. */
export interface ChipFiltro {
  clave: string;
  etiqueta: string;
}
