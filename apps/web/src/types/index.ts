import type { Role } from "./auth";

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
  /** Tipo de magnitud; `null` cuando el proveedor no lo informó (~3%). */
  magnitudeType: string | null;
  /** Profundidad en km; `null` cuando el proveedor no la informó (~1%). */
  depthKm: number | null;
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

/** Valor del filtro por tipo de magnitud: "" = todos, "none" = sin tipo informado. */
export type TipoMagnitudFiltro = "" | TipoMagnitud | "none";

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
  depthKm: number | null;
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
  magnitudTipo: TipoMagnitudFiltro;
  profundidadMin: number | null;
  profundidadMax: number | null;
  /** Búsqueda por localidad o identificador. */
  q: string;
  estado: "" | EstadoRevision;
}

/** Sección del resumen de la selección (una tarjeta, con su modal). */
export type SeccionResumen = "eventos" | "magnitud" | "profundidad" | "pendientes" | "sinTipo";

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

/* ════ Módulo "Fuentes de datos" (conector y ingesta) ════ */

/** Salud operativa del conector con el proveedor. */
export type EstadoConector = "operativo" | "degradado" | "sin_conexion";

/** Resultado de una ejecución de ingesta programada o manual. */
export type EstadoEjecucion = "correcta" | "con_errores" | "fallida" | "en_curso";

export type NivelLog = "INFO" | "WARN" | "ERROR";

/** Pestañas del módulo de Fuentes de datos. */
export type TabFuente = "ejecuciones" | "calidad" | "registro" | "configuracion";

/**
 * Una corrida de la ingesta. `en_curso` no tiene conteos todavía y
 * `errorResumen` es `null` salvo en estados con problemas.
 */
export interface EjecucionFuente {
  id: string;
  inicioUtc: string;
  duracionMs: number;
  latenciaMs: number;
  estado: EstadoEjecucion;
  leidos: number;
  insertados: number;
  /** Sismos ya guardados que la fuente corrigió y se actualizaron con historial (D27). */
  corregidos: number;
  duplicadosOmitidos: number;
  errorResumen: string | null;
  desencadenante: "programada" | "manual";
  httpStatus: number | null;
  correlacion: string;
  intentos: number;
}

/** Resumen de calidad por campo de la tabla de ingesta. */
export interface CalidadCampo {
  campo: string;
  /** Eventos con el campo nulo en la selección. */
  nulos: number;
  /** Total de eventos de la selección. */
  total: number;
  pctNulos: number;
  valorEjemplo: string;
  observacion: string | null;
}

/** Entrada del registro de la ingesta (logs). */
export interface LogFuente {
  id: string;
  horaUtc: string;
  nivel: NivelLog;
  mensaje: string;
  correlacion: string;
}

/** Ficha del conector con el proveedor. */
export interface ConectorFuente {
  nombre: string;
  organizacion: string;
  tipo: string;
  urlApi: string;
  frecuencia: string;
  ultimaEjecucionUtc: string;
  ultimoExitoUtc: string;
  latenciaMs: number;
  limitesUso: string | null;
  licencia: string | null;
  contacto: string | null;
  credencialRef: string;
}

/** Totales de la ventana observada, para las tarjetas KPI. */
export interface ResumenFuente {
  estadoConector: EstadoConector;
  estadoConectorDetalle: string;
  ultimoExitoUtc: string;
  latenciaMediaMs: number;
  tasaExitoPct: number;
  registrosInsertados: number;
  registrosCorregidos: number;
  duplicadosOmitidos: number;
}

/** Parámetros editables del conector (solo Administrador). */
export interface ConfiguracionFuente {
  frecuenciaMin: number;
  urlApi: string;
  licencia: string;
  contacto: string;
  limitesUso: string;
  reintentos: number;
  timeoutSeg: number;
  ingestaIdempotente: boolean;
  notificarErrores: boolean;
}

export interface FiltrosEjecuciones {
  estado: "" | EstadoEjecucion;
  periodo: string;
  orden: OrdenLista;
}

export interface FiltrosLogs {
  nivel: "" | NivelLog;
  orden: OrdenLista;
}

/** Orden de las listas: más recientes primero o más antiguos primero. */
export type OrdenLista = "recientes" | "antiguos";

export interface PaginaEjecuciones {
  filas: EjecucionFuente[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

export interface PaginaLogs {
  filas: LogFuente[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

/* ════ Módulo "Usuarios y roles" ════ */

/** Estado de una cuenta. Nadie elige su rol: lo asigna un Administrador. */
export type EstadoUsuario = "pendiente" | "activo" | "suspendido";

/** Cuenta tal como la administra el módulo (nunca incluye hash ni tokens). */
export interface UsuarioAdmin {
  id: string;
  nombre: string;
  correo: string;
  roles: Role[];
  estado: EstadoUsuario;
  mfa: boolean;
  ultimoAccesoUtc: string | null;
  creadoUtc: string;
  aprobadoPor: string | null;
  aprobadoUtc: string | null;
}

/** Entrada de la actividad reciente de una cuenta (sin secretos). */
export interface ActividadUsuario {
  id: string;
  horaUtc: string;
  accion: string;
  detalle: string;
  ip: string;
  resultado: "ok" | "fallido";
}

export interface FiltrosUsuarios {
  estado: "" | EstadoUsuario;
  rol: "" | Role;
  /** Búsqueda por nombre o correo. */
  q: string;
  ultimoAcceso: "" | "7d" | "30d" | "nunca";
  orden: OrdenLista;
}

export interface PaginaUsuarios {
  filas: UsuarioAdmin[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

export interface ResumenUsuarios {
  total: number;
  pendientes: number;
  activos: number;
  conMfa: number;
}

export interface ConteoRol {
  rol: Role;
  nombre: string;
  total: number;
}

/** Nivel de acceso de un rol sobre un módulo (matriz de permisos). */
export type AccesoPermiso = "ver" | "operar" | "sin_acceso";

export interface FilaMatrizPermisos {
  modulo: string;
  etiqueta: string;
  porRol: Record<Role, AccesoPermiso>;
}

/* ════ Módulo "Reportes" (centro de informes) ════ */

/** Tipo de informe. Los dos últimos dependen de proveedores externos. */
export type TipoReporte = "eventos" | "calidad_datos" | "fuentes_ingesta" | "modelos" | "alertas";

/** Estado del trabajo de generación de un informe. */
export type EstadoReporte = "pendiente" | "en_proceso" | "listo" | "fallido" | "expirado";

export type FormatoReporte = "csv" | "xlsx" | "pdf";

export type PeriodoReporte = "24h" | "7d" | "30d" | "90d" | "personalizado";

/**
 * Parámetros de un informe. Guardarlos hace **reproducible** el resultado: con
 * los mismos parámetros y la misma fecha de corte se obtienen las mismas filas.
 */
export interface ParametrosReporte {
  tipo: TipoReporte;
  formato: FormatoReporte;
  periodo: PeriodoReporte;
  desde: string;
  hasta: string;
  /** "" = todas las regiones. */
  zona: string;
  magnitudMin: number | null;
  reviewStatus: "" | EstadoRevision;
}

export interface EventoHistorialReporte {
  estado: EstadoReporte;
  horaUtc: string;
}

/** Un informe solicitado, con su estado y su enlace temporal. */
export interface Reporte {
  id: string;
  tipo: TipoReporte;
  formato: FormatoReporte;
  estado: EstadoReporte;
  nombre: string;
  solicitanteId: string;
  solicitante: string;
  /** Proveedor de los datos (una sola fuente: IGP). */
  fuente: string;
  /** Fecha de corte del informe (marca temporal "hasta"). */
  corteUtc: string;
  creadoUtc: string;
  iniciadoUtc: string | null;
  terminadoUtc: string | null;
  /** El enlace al archivo expira en esta marca (solo informes listos). */
  expiraUtc: string | null;
  filas: number | null;
  tamanoBytes: number | null;
  error: string | null;
  parametros: ParametrosReporte;
  historial: EventoHistorialReporte[];
  /** Con la API real: si el archivo del informe puede descargarse ahora. */
  descargaDisponible?: boolean;
}

export interface FiltrosReportes {
  tipo: "" | TipoReporte;
  estado: "" | EstadoReporte;
  /** "" = todas las personas; "mios" = solo las del usuario actual; o un id. */
  solicitante: string;
}

export interface PaginaReportes {
  filas: Reporte[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

export interface ResumenReportes {
  total: number;
  generados: number;
  enProceso: number;
  fallidos: number;
  porExpirar: number;
}

export interface ConteoTipoEstadoReporte {
  tipo: TipoReporte;
  nombre: string;
  estados: Record<EstadoReporte, number>;
  total: number;
}

/** Metadatos de un tipo de informe y su disponibilidad. */
export interface TipoReporteInfo {
  tipo: TipoReporte;
  nombre: string;
  descripcion: string;
  disponible: boolean;
}
