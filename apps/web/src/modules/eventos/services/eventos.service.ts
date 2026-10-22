import { DATA_RANGE_LABEL, FUENTE, LAST_SYNC_AT } from "@/lib/ancla";
import { periodBounds } from "@/lib/catalogo";
import { fmtDateTimeUTC5 } from "@/lib/format";
import { ApiError, apiGet } from "@/lib/api";
import { downloadFile } from "@/lib/export";
import { buildXlsx, type XlsxSheet } from "@/lib/xlsx";
import { SOURCE_NAME } from "@/config/fuente";
import { ordenarEventos, resumirFilas } from "../lib/calculo";
import type {
  EstadoRevision,
  EventoSismico,
  FiltrosEventos,
  OrdenEventos,
  PaginaEventos,
  ResumenEventos,
  TipoMagnitud,
} from "../types";
import { ETIQUETA_ESTADO } from "../schemas/filtros.schema";

/* ════════════════════════════════════════════════════════════════
   Capa de acceso a datos del módulo de Eventos sísmicos. SIEMPRE contra la API:
   `GET /api/v1/events` (periodo→`from`/`to` de `/meta`, orden, paginación y
   resumen calculados en cliente para coincidir con la tabla).
   ════════════════════════════════════════════════════════════════ */

interface EventOutAPI {
  id: string;
  external_id: string;
  occurred_at: string;
  latitude: number;
  longitude: number;
  depth_km: number | null;
  magnitude: number | null;
  magnitude_type: string | null;
  region: string | null;
  locality: string | null;
  review_status: string;
  source_url: string | null;
  received_at: string | null;
  origin_hash: string;
}

function adaptarEvento(e: EventOutAPI): EventoSismico {
  return {
    id: e.id,
    externalId: e.external_id,
    occurredAtUtc: e.occurred_at,
    latitude: e.latitude,
    longitude: e.longitude,
    magnitude: e.magnitude ?? 0,
    magnitudeType: (e.magnitude_type as TipoMagnitud | null) ?? null,
    depthKm: e.depth_km,
    region: e.region ?? "",
    locality: e.locality ?? "",
    reviewStatus: e.review_status as EstadoRevision,
    sourceUrl: e.source_url ?? "",
    receivedAtUtc: e.received_at ?? e.occurred_at,
    originHash: e.origin_hash,
  };
}

const MINUTO = 60_000;

/** Traduce los filtros a la query string de `GET /events`. */
function queryEventos(filtros: FiltrosEventos): string {
  const { start, end } = periodBounds(filtros.periodo || "30d", filtros.desde, filtros.hasta);
  const qs = new URLSearchParams();
  // Los periodos relativos (24 h, 7 d, 30 d) parten del reloj real, que cambia en
  // cada llamada: se redondean al minuto (inicio hacia abajo, fin hacia arriba)
  // para que la caché reconozca la misma consulta.
  if (Number.isFinite(start)) qs.set("from", new Date(Math.floor(start / MINUTO) * MINUTO).toISOString());
  if (Number.isFinite(end)) qs.set("to", new Date(Math.ceil(end / MINUTO) * MINUTO).toISOString());
  if (filtros.region) qs.set("region", filtros.region);
  if (filtros.magnitudMin != null) qs.set("mag_min", String(filtros.magnitudMin));
  if (filtros.magnitudMax != null) qs.set("mag_max", String(filtros.magnitudMax));
  if (filtros.magnitudTipo) qs.set("mag_type", filtros.magnitudTipo);
  if (filtros.profundidadMin != null) qs.set("depth_min", String(filtros.profundidadMin));
  if (filtros.profundidadMax != null) qs.set("depth_max", String(filtros.profundidadMax));
  if (filtros.q.trim()) qs.set("q", filtros.q.trim());
  if (filtros.estado) qs.set("review_status", filtros.estado);
  return qs.toString();
}

/* ════ Descarga de listas completas ════
   Varias pantallas filtran y agregan en cliente sobre el catálogo completo. Para
   que no tarde con miles de eventos se pide el catálogo **compacto**
   (`GET /events/compact`: una sola respuesta en filas, con los mismos valores que
   `GET /events`), y una caché corta compartida entre pantallas une además las
   peticiones iguales simultáneas (p. ej. tabla y resumen de Eventos). */

interface CatalogoCompactoAPI {
  columnas: (keyof EventOutAPI)[];
  filas: unknown[][];
  total: number;
}

/** Cuánto se reutiliza una descarga. La ingesta programada corre cada 15 min. */
const VIGENCIA_MS = 60_000;
/** Consultas distintas que se guardan a la vez. */
const MAX_ENTRADAS = 20;
/** Tiempo máximo para descargar una lista completa. */
const LIMITE_MS = 30_000;

const cache = new Map<string, { hasta: number; promesa: Promise<EventoSismico[]> }>();

async function descargarTodos(base: string): Promise<EventoSismico[]> {
  // Una petición colgada (p. ej. si la API se reinicia a mitad) no debe dejar la
  // pantalla cargando para siempre: se cancela y la pantalla muestra su error.
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), LIMITE_MS);
  let datos: CatalogoCompactoAPI;
  try {
    datos = await apiGet<CatalogoCompactoAPI>(`/events/compact${base ? `?${base}` : ""}`, { signal: control.signal });
  } catch (error) {
    if (control.signal.aborted) throw new ApiError(0, "La API tardó demasiado en responder. Reintente.");
    throw error;
  } finally {
    clearTimeout(limite);
  }
  // Cada fila se rearma con los nombres de `columnas` y pasa por la misma
  // conversión que un evento de `GET /events`.
  return datos.filas.map((fila) => {
    const evento: Record<string, unknown> = {};
    datos.columnas.forEach((columna, i) => {
      evento[columna] = fila[i];
    });
    return adaptarEvento(evento as unknown as EventOutAPI);
  });
}

async function conCache(base: string): Promise<EventoSismico[]> {
  const ahora = Date.now();
  for (const [clave, entrada] of cache) if (entrada.hasta <= ahora) cache.delete(clave);
  let entrada = cache.get(base);
  if (!entrada) {
    if (cache.size >= MAX_ENTRADAS) cache.delete(cache.keys().next().value as string);
    const promesa = descargarTodos(base);
    entrada = { hasta: ahora + VIGENCIA_MS, promesa };
    cache.set(base, entrada);
    // Un error no se guarda: el siguiente intento vuelve a pedir.
    promesa.catch(() => cache.delete(base));
  }
  // Copia: quien la reciba puede reordenarla sin afectar a las demás pantallas.
  return (await entrada.promesa).slice();
}

/** Descarta las listas guardadas (p. ej. tras sincronizar una fuente). */
export function invalidarCatalogo(): void {
  cache.clear();
}

/** Todos los eventos que cumplen los filtros (no solo la página). */
async function cargarFiltrados(filtros: FiltrosEventos): Promise<EventoSismico[]> {
  return conCache(queryEventos(filtros));
}

/**
 * Catálogo completo de eventos (sin filtrar). Lo usan los módulos que
 * filtran en cliente (mapa sísmico) para garantizar paridad con el catálogo.
 */
export async function cargarCatalogo(): Promise<EventoSismico[]> {
  return conCache("");
}

function paginar(filas: EventoSismico[], numero: number, tamano: number): PaginaEventos {  const t = Math.max(1, Math.floor(tamano) || 10);
  const total = filas.length;
  const totalPaginas = Math.max(1, Math.ceil(total / t));
  const n = Math.min(Math.max(1, Math.floor(numero) || 1), totalPaginas);
  const inicio = (n - 1) * t;
  return { filas: filas.slice(inicio, inicio + t), total, pagina: n, tamano: t, totalPaginas };
}

/**
 * Devuelve una página de eventos ya filtrada y ordenada.
 *
 *   GET /api/v1/events?from=&to=&region=&mag_min=&mag_max=&mag_type=&depth_min=&depth_max=&q=&review_status=
 *   → { items, total, … }
 */
export async function listarEventos(
  filtros: FiltrosEventos,
  orden: OrdenEventos,
  pagina: { numero: number; tamano: number },
): Promise<PaginaEventos> {
  return paginar(ordenarEventos(await cargarFiltrados(filtros), orden), pagina.numero, pagina.tamano);
}

/** Totales de la selección filtrada (sin paginar), para las tarjetas de resumen. */
export async function resumirEventos(filtros: FiltrosEventos): Promise<ResumenEventos> {
  return resumirFilas(await cargarFiltrados(filtros));
}

/* ════ Procedencia del catálogo ════ */

export interface Procedencia {
  fuente: string;
  ultimaSincronizacion: string;
  /** Licencia registrada en la fuente (`GET /meta`); `null` si no está cargada. */
  licencia: string | null;
  rangoCatalogo: string;
}

/**
 * Metadatos de la fuente para la franja de procedencia, todos de `GET /meta`:
 * licencia de la fuente, última sincronización y rango del catálogo.
 */
export function obtenerProcedencia(): Procedencia {
  return {
    fuente: SOURCE_NAME,
    ultimaSincronizacion: LAST_SYNC_AT ?? "",
    licencia: FUENTE?.licencia ?? null,
    rangoCatalogo: DATA_RANGE_LABEL,
  };
}

/* ════ Exportación (CSV / XLSX) ════ */

/** Filtros vacíos que abarcan todo el catálogo (para "Exportar todo"). */
export const FILTROS_CATALOGO: FiltrosEventos = {
  periodo: "custom",
  desde: "",
  hasta: "",
  region: "",
  magnitudMin: null,
  magnitudMax: null,
  magnitudTipo: "",
  profundidadMin: null,
  profundidadMax: null,
  q: "",
  estado: "",
};

export type FormatoExport = "csv" | "xlsx";
export type AlcanceExport = "filtrados" | "catalogo";

const COLUMNAS_EXPORT = [
  "Fecha y hora (UTC-5)",
  "Fecha (UTC)",
  "Localidad",
  "Región",
  "Magnitud",
  "Tipo",
  "Profundidad (km)",
  "Estado",
  "ID",
  "ID externo",
  "Latitud",
  "Longitud",
  "Proveedor",
  "URL de la fuente",
];

/**
 * Devuelve **todos** los eventos que cumplen los filtros (no solo la página),
 * con el mismo orden que la tabla. Base de la exportación y de los modales de
 * resumen.
 */
export async function listarSeleccion(filtros: FiltrosEventos, orden: OrdenEventos): Promise<EventoSismico[]> {
  return ordenarEventos(await cargarFiltrados(filtros), orden);
}

function filasExport(eventos: EventoSismico[]): (string | number | null)[][] {
  return eventos.map((e) => [
    fmtDateTimeUTC5(e.occurredAtUtc),
    e.occurredAtUtc,
    e.locality,
    e.region,
    e.magnitude.toFixed(1),
    e.magnitudeType ?? "—",
    e.depthKm,
    ETIQUETA_ESTADO[e.reviewStatus],
    e.id,
    e.externalId,
    e.latitude.toFixed(4),
    e.longitude.toFixed(4),
    SOURCE_NAME,
    e.sourceUrl,
  ]);
}

function celda(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Descarga los eventos en el formato elegido (CSV con BOM o Excel .xlsx). */
export function descargarEventos(eventos: EventoSismico[], formato: FormatoExport, nombre: string): void {
  const filas = filasExport(eventos);
  if (formato === "xlsx") {
    const hoja: XlsxSheet = { name: "Eventos", cols: COLUMNAS_EXPORT, rows: filas };
    downloadFile(`${nombre}.xlsx`, buildXlsx([hoja]));
    return;
  }
  const lineas = [COLUMNAS_EXPORT.map(celda).join(";"), ...filas.map((f) => f.map(celda).join(";"))];
  downloadFile(`${nombre}.csv`, "\uFEFF" + lineas.join("\r\n"), "text/csv;charset=utf-8");
}

/** Nombre de archivo sugerido para una exportación. */
export function nombreExport(alcance: AlcanceExport, fecha: string): string {
  return `eventos_sismicos_${alcance}_${fecha}`;
}
