export type EventStatus = "observed" | "pending_review" | "experimental" | "official_comm";

export const STATUS_LABELS: Record<EventStatus, string> = {
  observed: "Observado",
  pending_review: "Pendiente de validación",
  experimental: "Estimación experimental",
  official_comm: "Comunicado oficial",
};

export const STATUS_COLORS: Record<EventStatus, string> = {
  observed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  pending_review: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  experimental: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  official_comm: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export interface SeismicEvent {
  id: string;
  externalId: string;
  sourceId: string;
  sourceName: string;
  occurredAt: string;
  magnitude: number;
  magnitudeType: string;
  depthKm: number;
  place: string;
  region: string;
  sourceUrl: string;
  receivedAt: string;
  status: EventStatus;
}

export interface DataSource {
  id: string;
  name: string;
  organization: string;
  status: "online" | "degraded" | "offline";
  lastSyncAt: string;
  latencyMs: number;
  recordsToday: number;
}

export interface AlertItem {
  id: string;
  kind: "seismic" | "operational";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  status: "pending" | "sent" | "failed" | "cancelled";
  createdAt: string;
  channel: string;
  destination: string;
}

export interface KpiCard {
  label: string;
  value: string;
  change?: string;
  changeType?: "up" | "down" | "neutral";
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface MagnitudeBucket {
  range: string;
  count: number;
}

export interface RoleOption {
  value: string;
  label: string;
}

/* ════ Módulo "Eventos sísmicos" (catálogo operativo) ════ */

/** Estado de revisión de un evento en el módulo de eventos. */
export type EstadoRevision = "observado" | "pendiente_validacion";

/** Tipo de magnitud reportado por la fuente; `null` cuando aún no se determinó. */
export type TipoMagnitud = "Mw" | "ML" | "mb";

/**
 * Evento sísmico tal como lo consume el módulo de Eventos.
 * Es independiente de `SeismicEvent` (que alimenta el Dashboard) para que el
 * módulo pueda migrar a la API real (`GET /api/v1/events`) sin arrastrar el resto.
 */
export interface EventoSismico {
  id: string;
  externalId: string;
  occurredAtUtc: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  magnitudeType: TipoMagnitud | null;
  depthKm: number;
  region: string;
  locality: string;
  reviewStatus: EstadoRevision;
  sourceUrl: string;
  receivedAtUtc: string;
  originHash: string;
}

/** Columnas por las que se puede ordenar la tabla de eventos (incluye las opcionales). */
export type CampoOrdenEventos =
  | "fecha"
  | "localidad"
  | "region"
  | "magnitud"
  | "profundidad"
  | "estado"
  | "id"
  | "latitud"
  | "longitud";

export interface OrdenEventos {
  campo: CampoOrdenEventos;
  direccion: "asc" | "desc";
}

/** Filtros del módulo. Los valores vacíos/`null` significan "sin restricción". */
export interface FiltrosEventos {
  periodo: string;
  desde: string;
  hasta: string;
  region: string;
  magnitudMin: number | null;
  magnitudMax: number | null;
  estado: "" | EstadoRevision;
}

/** Página de resultados lista para pintar en la tabla. */
export interface PaginaEventos {
  filas: EventoSismico[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

/** Rango de profundidades de la selección. */
export interface RangoProfundidad {
  min: number;
  mediana: number;
  max: number;
}

/** Totales de la selección filtrada, para las tarjetas de resumen. */
export interface ResumenEventos {
  total: number;
  magnitudMaxima: EventoSismico | null;
  profundidad: RangoProfundidad | null;
  pendientes: number;
  sinTipo: number;
}
