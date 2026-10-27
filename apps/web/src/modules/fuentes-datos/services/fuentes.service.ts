import { dayKeyUTC5, fmtDateTimeUTC5, fmtTimeUTC5 } from "@/lib/format";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { MetaInfo } from "@/lib/ancla";
import { downloadFile } from "@/lib/export";
import { buildXlsx } from "@/lib/xlsx";
import { SOURCE_NAME } from "@/config/fuente";
import { invalidarCatalogo } from "@/modules/eventos/services/eventos.service";
import type {
  CalidadCampo,
  ConfiguracionFuente,
  ConectorFuente,
  EjecucionFuente,
  FiltrosEjecuciones,
  FiltrosLogs,
  LogFuente,
  PaginaEjecuciones,
  PaginaLogs,
  ResumenFuente,
} from "../types";
import { ETIQUETA_CONECTOR, ETIQUETA_EJECUCION, ETIQUETA_NIVEL } from "../schemas/fuentes.schema";

/* ════════════════════════════════════════════════════════════════
   Capa de acceso a datos del módulo "Fuentes de datos". SIEMPRE contra la API:
     GET   /api/v1/sources                     → id de la fuente única
     GET   /api/v1/sources/{id}                → resumen + config + por hora
     GET   /api/v1/sources/{id}/quality        → calidad por campo
     GET   /api/v1/sources/{id}/runs           → ejecuciones (filtros + página)
     GET   /api/v1/sources/{id}/logs           → registro
     PUT   /api/v1/sources/{id}/config         → guardar configuración
     POST  /api/v1/sources/{id}/sync           → sincronización manual
   ════════════════════════════════════════════════════════════════ */

/* ─────────────────────────── Adaptador API ─────────────────────────── */

interface RunAPI {
  id: string;
  status: string;
  triggered_by: string;
  started_at: string;
  duration_ms: number | null;
  latency_ms: number | null;
  http_status: number | null;
  records_read: number;
  records_inserted: number;
  records_updated?: number;
  duplicates_skipped: number;
  attempts: number;
  error_summary: string | null;
  correlation_id: string | null;
}

interface LogAPI {
  id: number;
  ts: string;
  level: string;
  message: string;
  correlation_id: string | null;
}

interface SourceAPI {
  id: string;
  key: string;
  name: string;
  organization: string;
  kind: string;
  url_api: string | null;
  config_ref: string;
  frequency_min: number;
  retries: number;
  timeout_sec: number;
  idempotent: boolean;
  notify_errors: boolean;
  usage_limits: string | null;
  license: string | null;
  contact: string | null;
}

interface SummaryAPI {
  estado_conector: string;
  estado_conector_detalle: string;
  ultimo_exito: string | null;
  latencia_media_ms: number;
  tasa_exito_pct: number;
  registros_insertados: number;
  registros_corregidos?: number;
  duplicados_omitidos: number;
}

interface DetailAPI {
  source: SourceAPI;
  summary: SummaryAPI;
  config: SourceAPI;
}

interface QualityAPI {
  campos: {
    campo: string;
    nulos: number;
    porcentaje_nulos: number;
    valor_ejemplo: string | null;
    observacion: string | null;
  }[];
  total_eventos: number;
}

interface RunsPageAPI {
  items: RunAPI[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

interface LogsPageAPI {
  items: LogAPI[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

function adaptarEjecucion(r: RunAPI): EjecucionFuente {
  return {
    id: r.id,
    inicioUtc: r.started_at,
    duracionMs: r.duration_ms ?? 0,
    latenciaMs: r.latency_ms ?? 0,
    estado: r.status as EjecucionFuente["estado"],
    leidos: r.records_read,
    insertados: r.records_inserted,
    corregidos: r.records_updated ?? 0,
    duplicadosOmitidos: r.duplicates_skipped,
    errorResumen: r.error_summary,
    desencadenante: r.triggered_by === "manual" ? "manual" : "programada",
    httpStatus: r.http_status,
    correlacion: r.correlation_id ?? "",
    intentos: r.attempts,
  };
}

function adaptarLog(l: LogAPI): LogFuente {
  return {
    id: String(l.id),
    horaUtc: l.ts,
    nivel: l.level as LogFuente["nivel"],
    mensaje: l.message,
    correlacion: l.correlation_id ?? "",
  };
}

function adaptarResumen(s: SummaryAPI): ResumenFuente {
  return {
    estadoConector: s.estado_conector as ResumenFuente["estadoConector"],
    estadoConectorDetalle: s.estado_conector_detalle,
    ultimoExitoUtc: s.ultimo_exito ?? new Date().toISOString(),
    latenciaMediaMs: s.latencia_media_ms,
    tasaExitoPct: s.tasa_exito_pct,
    registrosInsertados: s.registros_insertados,
    registrosCorregidos: s.registros_corregidos ?? 0,
    duplicadosOmitidos: s.duplicados_omitidos,
  };
}

function adaptarConfig(source: SourceAPI): ConfiguracionFuente {
  return {
    frecuenciaMin: source.frequency_min,
    urlApi: source.url_api ?? "",
    licencia: source.license ?? "",
    contacto: source.contact ?? "",
    limitesUso: source.usage_limits ?? "",
    reintentos: source.retries,
    timeoutSeg: source.timeout_sec,
    ingestaIdempotente: source.idempotent,
    notificarErrores: source.notify_errors,
  };
}

function adaptarFicha(source: SourceAPI, summary: SummaryAPI, ultimaEjecucion: string | null): ConectorFuente {
  return {
    nombre: source.name,
    organizacion: source.organization,
    tipo: source.kind,
    urlApi: source.url_api ?? "",
    frecuencia: `Cada ${source.frequency_min} min`,
    ultimaEjecucionUtc: ultimaEjecucion ?? summary.ultimo_exito ?? new Date().toISOString(),
    ultimoExitoUtc: summary.ultimo_exito ?? new Date().toISOString(),
    latenciaMs: summary.latencia_media_ms,
    limitesUso: source.usage_limits,
    licencia: source.license,
    contacto: source.contact,
    credencialRef: source.config_ref,
  };
}

let _sourceId: Promise<string> | null = null;

/** Identificador de la fuente única del catálogo (cacheado). */
function sourceId(): Promise<string> {
  if (!_sourceId) {
    _sourceId = apiGet<{ items: SourceAPI[] }>("/sources").then((d) => {
      const id = d.items[0]?.id;
      if (!id) throw new Error("No hay fuentes configuradas.");
      return id;
    });
  }
  return _sourceId;
}

async function cargarDetalle(): Promise<DetailAPI & { ultimaEjecucion: string | null }> {
  const id = await sourceId();
  const detail = await apiGet<DetailAPI>(`/sources/${id}`);
  const primera = await apiGet<RunsPageAPI>(`/sources/${id}/runs?pagina=1&tamano=1`).catch(() => null);
  return { ...detail, ultimaEjecucion: primera?.items?.[0]?.started_at ?? null };
}

/** Todas las ejecuciones filtradas (recorriendo la paginación del API). */
async function _todasEjecuciones(filtros: FiltrosEjecuciones): Promise<EjecucionFuente[]> {
  const id = await sourceId();
  const filas: EjecucionFuente[] = [];
  let pagina = 1;
  for (;;) {
    const qs = new URLSearchParams();
    if (filtros.estado) qs.set("estado", filtros.estado);
    if (filtros.periodo) qs.set("periodo", filtros.periodo);
    qs.set("pagina", String(pagina));
    qs.set("tamano", "100");
    const data = await apiGet<RunsPageAPI>(`/sources/${id}/runs?${qs.toString()}`);
    filas.push(...data.items.map(adaptarEjecucion));
    if (pagina >= data.total_paginas || data.items.length === 0) break;
    pagina += 1;
  }
  return filas;
}

/** Todas las entradas del registro filtradas (recorriendo la paginación del API). */
async function _todosLogs(filtros: FiltrosLogs): Promise<LogFuente[]> {
  const id = await sourceId();
  const filas: LogFuente[] = [];
  let pagina = 1;
  for (;;) {
    const qs = new URLSearchParams();
    if (filtros.nivel) qs.set("nivel", filtros.nivel);
    qs.set("pagina", String(pagina));
    qs.set("tamano", "100");
    const data = await apiGet<LogsPageAPI>(`/sources/${id}/logs?${qs.toString()}`);
    filas.push(...data.items.map(adaptarLog));
    if (pagina >= data.total_paginas || data.items.length === 0) break;
    pagina += 1;
  }
  return filas;
}

/** Orden del mock: `recientes` = inicio descendente; `antiguos` = ascendente. */
function _ordenarEjecuciones(filas: EjecucionFuente[], orden: string): EjecucionFuente[] {
  const asc = [...filas].sort((a, b) => a.inicioUtc.localeCompare(b.inicioUtc));
  return orden === "antiguos" ? asc : asc.reverse();
}

/** Orden del mock para el registro: por marca de tiempo descendente (o ascendente). */
function _ordenarLogs(filas: LogFuente[], orden: string): LogFuente[] {
  const asc = [...filas].sort((a, b) => a.horaUtc.localeCompare(b.horaUtc));
  return orden === "antiguos" ? asc : asc.reverse();
}

function paginarFilas<T>(
  filas: T[],
  pagina: number,
  tamano: number,
): { filas: T[]; total: number; pagina: number; tamano: number; totalPaginas: number } {
  const total = filas.length;
  const t = Math.max(1, Math.floor(tamano) || 10);
  const totalPaginas = Math.max(1, Math.ceil(total / t));
  const n = Math.min(Math.max(1, Math.floor(pagina) || 1), totalPaginas);
  const inicio = (n - 1) * t;
  return { filas: filas.slice(inicio, inicio + t), total, pagina: n, tamano: t, totalPaginas };
}

/* ─────────────────────────── Lectura ─────────────────────────── */

export interface BarraFuente {
  organizacion: string;
  nombre: string;
  estadoConector: ResumenFuente["estadoConector"];
  ultimoExitoUtc: string;
}

/** Estado resumido de la fuente única, para la barra superior. Sale de `GET /meta`,
    que ven todos los roles (el detalle de /sources es solo para quien gestiona fuentes). */
export async function cargarBarraFuente(): Promise<BarraFuente | null> {
  const meta = await apiGet<MetaInfo>("/meta");
  const f = meta.fuente;
  if (!f || f.estado_conector === "sin_datos") return null;
  return {
    organizacion: f.organizacion,
    nombre: f.nombre,
    estadoConector: f.estado_conector,
    ultimoExitoUtc: f.ultimo_exito ?? "",
  };
}

export interface MetaFuente {
  resumen: ResumenFuente;
  ficha: ConectorFuente;
  calidad: CalidadCampo[];
  configuracion: ConfiguracionFuente;
}

/** Ficha, resumen, calidad y configuración del conector. */
export async function cargarMeta(): Promise<MetaFuente> {
  const [detalle, calidad] = await Promise.all([
    cargarDetalle(),
    sourceId().then((id) => apiGet<QualityAPI>(`/sources/${id}/quality`)),
  ]);
  return {
    resumen: adaptarResumen(detalle.summary),
    ficha: adaptarFicha(detalle.source, detalle.summary, detalle.ultimaEjecucion),
    calidad: calidad.campos.map((c) => ({
      campo: c.campo,
      nulos: c.nulos,
      total: calidad.total_eventos,
      pctNulos: c.porcentaje_nulos,
      valorEjemplo: c.valor_ejemplo ?? "",
      observacion: c.observacion,
    })),
    configuracion: adaptarConfig(detalle.config),
  };
}

export async function listarEjecuciones(
  filtros: FiltrosEjecuciones,
  pagina: number,
  tamano: number,
): Promise<PaginaEjecuciones> {
  const filas = await _todasEjecuciones(filtros);
  return paginarFilas(_ordenarEjecuciones(filas, filtros.orden), pagina, tamano);
}

/** Todas las ejecuciones de la ventana filtrada (para el gráfico de latencia). */
export async function listarEjecucionesVentana(filtros: FiltrosEjecuciones): Promise<EjecucionFuente[]> {
  return _todasEjecuciones(filtros);
}

export async function listarLogs(filtros: FiltrosLogs, pagina: number, tamano: number): Promise<PaginaLogs> {
  const filas = await _todosLogs(filtros);
  return paginarFilas(_ordenarLogs(filas, filtros.orden), pagina, tamano);
}

/* ════ Consultas para las vistas ampliadas ════ */

/** Todas las ejecuciones de la ventana filtrada (sin paginar). */
export function ventanaEjecuciones(filtros: FiltrosEjecuciones): Promise<EjecucionFuente[]> {
  return listarEjecucionesVentana(filtros);
}

/** Registro completo filtrado (sin paginar). */
export async function registroCompleto(filtros: FiltrosLogs): Promise<LogFuente[]> {
  return _todosLogs(filtros);
}

/** Guarda la configuración del conector (solo Administrador). */
export async function guardarConfiguracion(config: ConfiguracionFuente): Promise<void> {
  const id = await sourceId();
  await apiPut(`/sources/${id}/config`, {
    frequency_min: config.frecuenciaMin,
    retries: config.reintentos,
    timeout_sec: config.timeoutSeg,
    idempotent: config.ingestaIdempotente,
    notify_errors: config.notificarErrores,
    url_api: config.urlApi || null,
    usage_limits: config.limitesUso || null,
    license: config.licencia || null,
    contact: config.contacto || null,
  });
}

export interface ResultadoSincronizacion {
  id: string;
  inicioUtc: string;
  insertados: number;
  corregidos: number;
  duplicadosOmitidos: number;
}

/**
 * Sincronización manual (solo Administrador). La ingesta es idempotente: no
 * duplica eventos ya presentes. En la API real queda registrada en Auditoría.
 */
export async function sincronizarAhora(): Promise<ResultadoSincronizacion> {
  const id = await sourceId();
  const aceptado = await apiPost<{ run_id: string }>(`/sources/${id}/sync`);
  const runId = aceptado.run_id;
  // La ingesta corre en segundo plano: se espera su finalización consultando el run.
  for (let intento = 0; intento < 30; intento += 1) {
    await new Promise((r) => setTimeout(r, 700));
    const p = await apiGet<RunsPageAPI>(`/sources/${id}/runs?pagina=1&tamano=50`);
    const run = p.items.find((r) => r.id === runId);
    if (run && run.status !== "en_curso") {
      // Puede haber eventos nuevos: las demás pantallas deben volver a pedirlos.
      invalidarCatalogo();
      return {
        id: run.id,
        inicioUtc: run.started_at,
        insertados: run.records_inserted,
        corregidos: run.records_updated ?? 0,
        duplicadosOmitidos: run.duplicates_skipped,
      };
    }
  }
  return { id: runId, inicioUtc: new Date().toISOString(), insertados: 0, corregidos: 0, duplicadosOmitidos: 0 };
}

/* ════ Resumen por hora (series de la vista ampliada) ════ */

export interface HoraResumen {
  hora: string;
  ejecuciones: number;
  correctas: number;
  conErrores: number;
  fallidas: number;
  pctExito: number;
  latenciaMedia: number;
  insertados: number;
  corregidos: number;
  duplicados: number;
}

/** Agrupa las ejecuciones de la ventana por hora (UTC-5), de más antigua a más reciente. */
export function resumenPorHora(ventana: EjecucionFuente[]): HoraResumen[] {
  const mapa = new Map<string, EjecucionFuente[]>();
  const ascendente = [...ventana].sort((a, b) => a.inicioUtc.localeCompare(b.inicioUtc));
  for (const e of ascendente) {
    const hh = fmtTimeUTC5(e.inicioUtc).slice(0, 2);
    const clave = `${dayKeyUTC5(e.inicioUtc)}T${hh}`;
    const lista = mapa.get(clave);
    if (lista) lista.push(e);
    else mapa.set(clave, [e]);
  }

  const out: HoraResumen[] = [];
  for (const [clave, lista] of mapa) {
    const finalizadas = lista.filter((e) => e.estado !== "en_curso");
    const correctas = finalizadas.filter((e) => e.estado === "correcta").length;
    const conErrores = finalizadas.filter((e) => e.estado === "con_errores").length;
    const fallidas = finalizadas.filter((e) => e.estado === "fallida").length;
    const conLatencia = finalizadas.filter((e) => e.estado !== "fallida");
    out.push({
      hora: `${clave.slice(-2)}:00`,
      ejecuciones: lista.length,
      correctas,
      conErrores,
      fallidas,
      pctExito: finalizadas.length ? Math.round(((correctas + conErrores) / finalizadas.length) * 1000) / 10 : 0,
      latenciaMedia: conLatencia.length ? Math.round(conLatencia.reduce((s, e) => s + e.latenciaMs, 0) / conLatencia.length) : 0,
      insertados: lista.reduce((s, e) => s + e.insertados, 0),
      corregidos: lista.reduce((s, e) => s + e.corregidos, 0),
      duplicados: lista.reduce((s, e) => s + e.duplicadosOmitidos, 0),
    });
  }
  return out;
}

/* ════ Exportación por partes (CSV / XLSX) ════ */

export type ParteExportId = "resumen" | "conector" | "ejecuciones" | "hora" | "calidad" | "registro" | "configuracion";

export interface ParteExport {
  id: ParteExportId;
  label: string;
  /** Nombre de la hoja en el libro de Excel. */
  hoja: string;
}

export const PARTES_EXPORT: ParteExport[] = [
  { id: "resumen", label: "Resumen (indicadores)", hoja: "Resumen" },
  { id: "conector", label: "Ficha del conector", hoja: "Conector" },
  { id: "ejecuciones", label: "Ejecuciones", hoja: "Ejecuciones" },
  { id: "hora", label: "Resumen por hora", hoja: "Por hora" },
  { id: "calidad", label: "Calidad por campo", hoja: "Calidad" },
  { id: "registro", label: "Registro (logs)", hoja: "Registro" },
  { id: "configuracion", label: "Configuración", hoja: "Configuracion" },
];

/** Datos ya reunidos para exportar. `cargarContextoExport` lo construye. */
export interface ContextoExport {
  filtrosEjec: FiltrosEjecuciones;
  filtrosLogs: FiltrosLogs;
  meta: MetaFuente;
  ventana: EjecucionFuente[];
  registro: LogFuente[];
}

/** Reúne los datos necesarios para exportar. */
export async function cargarContextoExport(
  filtrosEjec: FiltrosEjecuciones,
  filtrosLogs: FiltrosLogs,
): Promise<ContextoExport> {
  const [meta, ventana, registro] = await Promise.all([
    cargarMeta(),
    ventanaEjecuciones(filtrosEjec),
    registroCompleto(filtrosLogs),
  ]);
  return { filtrosEjec, filtrosLogs, meta, ventana, registro };
}

export interface Bloque {
  cols: string[];
  rows: (string | number | null)[][];
}

function celda(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Construye las columnas y filas de una parte de la exportación. */
export function construirBloque(id: ParteExportId, ctx: ContextoExport): Bloque {
  switch (id) {
    case "resumen": {
      const r = ctx.meta.resumen;
      return {
        cols: ["Indicador", "Valor"],
        rows: [
          ["Estado del conector", ETIQUETA_CONECTOR[r.estadoConector]],
          ["Detalle del estado", r.estadoConectorDetalle],
          ["Último éxito (UTC-5)", fmtDateTimeUTC5(r.ultimoExitoUtc)],
          ["Latencia media (ms)", r.latenciaMediaMs],
          ["Tasa de éxito (%)", Math.round(r.tasaExitoPct * 10) / 10],
          ["Registros insertados", r.registrosInsertados],
          ["Registros corregidos por la fuente", r.registrosCorregidos],
          ["Duplicados omitidos", r.duplicadosOmitidos],
        ],
      };
    }
    case "conector": {
      const f = ctx.meta.ficha;
      return {
        cols: ["Campo", "Valor"],
        rows: [
          ["Nombre", f.nombre],
          ["Organización", f.organizacion],
          ["Tipo", f.tipo],
          ["URL / API", f.urlApi],
          ["Frecuencia", f.frecuencia],
          ["Última ejecución (UTC-5)", fmtDateTimeUTC5(f.ultimaEjecucionUtc)],
          ["Último éxito (UTC-5)", fmtDateTimeUTC5(f.ultimoExitoUtc)],
          ["Latencia media (ms)", f.latenciaMs],
          ["Límites de uso", f.limitesUso ?? "pendiente"],
          ["Licencia", f.licencia ?? "pendiente"],
          ["Contacto", f.contacto ?? "pendiente"],
          ["Credenciales", f.credencialRef],
        ],
      };
    }
    case "configuracion": {
      const c = ctx.meta.configuracion;
      return {
        cols: ["Parámetro", "Valor"],
        rows: [
          ["Frecuencia (min)", c.frecuenciaMin],
          ["URL / API", c.urlApi],
          ["Reintentos", c.reintentos],
          ["Timeout (s)", c.timeoutSeg],
          ["Ingesta idempotente", c.ingestaIdempotente ? "Sí" : "No"],
          ["Notificar errores", c.notificarErrores ? "Sí" : "No"],
          ["Límites de uso", c.limitesUso || "pendiente"],
          ["Licencia", c.licencia || "pendiente"],
          ["Contacto", c.contacto || "pendiente"],
        ],
      };
    }
    case "ejecuciones":
      return {
        cols: ["ejecucion", "inicio_utc5", "duracion_ms", "latencia_ms", "estado", "leidos", "insertados", "corregidos", "duplicados_omitidos", "desencadenante", "http", "error"],
        rows: ctx.ventana.map((e) => [
          e.id,
          fmtDateTimeUTC5(e.inicioUtc),
          e.duracionMs,
          e.latenciaMs,
          ETIQUETA_EJECUCION[e.estado],
          e.leidos,
          e.insertados,
          e.corregidos,
          e.duplicadosOmitidos,
          e.desencadenante,
          e.httpStatus,
          e.errorResumen ?? "",
        ]),
      };
    case "hora":
      return {
        cols: ["hora_utc5", "ejecuciones", "correctas", "con_errores", "fallidas", "tasa_exito_pct", "latencia_media_ms", "insertados", "corregidos", "duplicados"],
        rows: resumenPorHora(ctx.ventana).map((h) => [
          h.hora,
          h.ejecuciones,
          h.correctas,
          h.conErrores,
          h.fallidas,
          h.pctExito,
          h.latenciaMedia,
          h.insertados,
          h.corregidos,
          h.duplicados,
        ]),
      };
    case "calidad":
      return {
        cols: ["campo", "nulos", "total", "porcentaje_nulos", "valor_ejemplo", "observacion"],
        rows: ctx.meta.calidad.map((c) => [c.campo, c.nulos, c.total, c.pctNulos, c.valorEjemplo, c.observacion ?? ""]),
      };
    case "registro":
      return {
        cols: ["hora_utc5", "nivel", "mensaje", "correlacion"],
        rows: ctx.registro.map((l) => [fmtDateTimeUTC5(l.horaUtc), ETIQUETA_NIVEL[l.nivel], l.mensaje, l.correlacion]),
      };
  }
}

export type FormatoExport = "csv" | "xlsx";

const fecha = () => new Date().toISOString().slice(0, 10);

/** Contenido CSV de las partes seleccionadas (una sección por bloque). */
export function textoPartes(ids: ParteExportId[], ctx: ContextoExport): string {
  const partes = PARTES_EXPORT.filter((p) => ids.includes(p.id));
  const lineas: string[] = [];
  partes.forEach((p, i) => {
    if (i) lineas.push("");
    lineas.push(`# ${p.label}`);
    const b = construirBloque(p.id, ctx);
    lineas.push(b.cols.map(celda).join(";"));
    for (const fila of b.rows) lineas.push(fila.map(celda).join(";"));
  });
  return lineas.join("\r\n");
}

/** Descarga las partes seleccionadas como CSV (un bloque) o Excel (una hoja por parte). */
export function exportarPartes(ids: ParteExportId[], formato: FormatoExport, ctx: ContextoExport): void {
  const partes = PARTES_EXPORT.filter((p) => ids.includes(p.id));
  if (!partes.length) return;

  if (formato === "xlsx") {
    const hojas = partes.map((p) => {
      const b = construirBloque(p.id, ctx);
      return { name: p.hoja, cols: b.cols, rows: b.rows };
    });
    downloadFile(`fuente_datos_${fecha()}.xlsx`, buildXlsx(hojas));
    return;
  }

  downloadFile(`fuente_datos_${fecha()}.csv`, "\uFEFF" + textoPartes(ids, ctx), "text/csv;charset=utf-8");
}

/* ════ Procedencia (pie) ════ */

export async function cargarProcedencia(): Promise<{ fuente: string; ventana: string }> {
  const ventana = await ventanaEjecuciones({ estado: "", periodo: "", orden: "antiguos" });
  const masAntigua = ventana[0];
  const fin = new Date().toISOString();
  return {
    fuente: SOURCE_NAME,
    ventana: `${fmtDateTimeUTC5(masAntigua?.inicioUtc ?? fin)} – ${fmtDateTimeUTC5(fin)}`,
  };
}
