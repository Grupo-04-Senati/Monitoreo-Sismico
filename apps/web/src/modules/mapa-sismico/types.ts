import type { EventoSismico, EstadoRevision } from "@/types";

export type { EventoSismico, EstadoRevision };

/** Capa visible del mapa. */
export type CapaMapa = "ambos" | "regiones" | "eventos";

/** Filtros del módulo de mapa. Viven en la URL (fuente de la verdad). */
export interface FiltrosMapa {
  periodo: string;
  desde: string;
  hasta: string;
  /** Slug de la región (área geográfica) o "" = todas. */
  region: string;
  magnitudMin: number | null;
  magnitudMax: number | null;
  capa: CapaMapa;
  estado: "" | EstadoRevision;
  /** Centro del radio (solo búsqueda por distancia). */
  rlat: number | null;
  rlon: number | null;
  radioKm: number | null;
}

/** Fila de la tabla de las 25 regiones. */
export interface RegionResumen {
  slug: string;
  nombre: string;
  eventos: number;
  porcentaje: number;
  magnitudMaxima: number | null;
}

/** Un anillo de coordenadas `[lon, lat]`. */
export type Coord = [number, number];

/** Región del GeoJSON ya emparejada con el catálogo de 25 departamentos. */
export interface FormaRegion {
  slug: string;
  nombre: string;
  /** Lista de polígonos; cada polígono es una lista de anillos (el primero exterior). */
  polys: Coord[][][];
}

/** Resultado de interpretar el GeoJSON cargado por el usuario. */
export interface GeoRegiones {
  formas: FormaRegion[];
  /** Features sin ninguna propiedad de nombre reconocida. */
  sinNombre: number;
  /** Nombres que no coinciden con los 25 departamentos. */
  noCoinciden: string[];
  /** `[minLon, minLat, maxLon, maxLat]`. */
  bbox: [number, number, number, number];
}

/** Evento ya proyectado a coordenadas SVG. */
export interface PuntoMapa {
  evento: EventoSismico;
  /** Índice dentro de la lista filtrada (para el detalle). */
  indice: number;
  x: number;
  y: number;
}

/** Agrupación de puntos cercanos en pantalla. */
export interface ClusterMapa {
  x: number;
  y: number;
  puntos: PuntoMapa[];
}

/** Opción de la barra de filtros. */
export interface OpcionFiltro {
  value: string;
  label: string;
}

/** Filtro activo mostrado como chip removible. */
export interface ChipFiltro {
  clave: string;
  etiqueta: string;
}

/** Errores de validación mostrados junto a cada campo. */
export interface ErroresFiltros {
  desde?: string;
  hasta?: string;
  magnitud?: string;
  radio?: string;
}
