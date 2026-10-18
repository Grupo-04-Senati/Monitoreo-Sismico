import { REGION_OPTIONS } from "@/lib/catalogo";
import { fmtDateTimeUTC5 } from "@/lib/format";
import { apiGet, apiPost } from "@/lib/api";
import { downloadFile } from "@/lib/export";
import type { User } from "@/types/auth";
import type { EstadoRevision } from "@/types";
import type {
  ConteoTipoEstadoReporte,
  EstadoReporte,
  FiltrosReportes,
  FormatoReporte,
  PaginaReportes,
  ParametrosReporte,
  PeriodoReporte,
  Reporte,
  ResumenReportes,
  TipoReporte,
  TipoReporteInfo,
} from "../types";
import { ETIQUETA_TIPO, PERIODOS, TIPOS, etiquetaZona } from "../schemas/reportes.schema";

/* ════════════════════════════════════════════════════════════════
   Capa de acceso a datos del módulo "Reportes". SIEMPRE contra la API:
     GET  /api/v1/reports?tipo&estado&solicitante&pagina&tamano
     GET  /api/v1/reports/types
     POST /api/v1/reports
     GET  /api/v1/reports/{id}
     GET  /api/v1/reports/{id}/download   (410 si el enlace expiró)
   Cada generación y cada descarga llama a `registrar_auditoria()` en el
   backend; el enlace caduca a las TTL_HORAS.
   ════════════════════════════════════════════════════════════════ */

/* ════ Adaptador de la API real ════ */

interface ReportOutAPI {
  id: string;
  name: string;
  tipo: string;
  tipo_label: string;
  formato: string;
  status: string;
  status_label: string;
  source: string;
  requested_by: string;
  requested_by_name: string;
  corte: string;
  params: Record<string, unknown>;
  row_count: number | null;
  file_size: number | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  expires_at: string | null;
  expirado: boolean;
  descarga_disponible: boolean;
}

interface ReportListAPI {
  items: ReportOutAPI[];
  total: number;
  page: number;
  page_size: number;
  resumen: { total: number; generados: number; en_proceso: number; fallidos: number; por_expirar: number };
  por_tipo_estado: { tipo: string; tipo_label: string; estados: Record<string, number>; total: number }[];
}

function derivarHistorial(r: ReportOutAPI): { estado: EstadoReporte; horaUtc: string }[] {
  const h: { estado: EstadoReporte; horaUtc: string }[] = [{ estado: "pendiente", horaUtc: r.created_at }];
  if (r.started_at) h.push({ estado: "en_proceso", horaUtc: r.started_at });
  if (r.finished_at) h.push({ estado: r.status as EstadoReporte, horaUtc: r.finished_at });
  return h;
}

function adaptarReporte(r: ReportOutAPI): Reporte {
  const p = r.params ?? {};
  const filtros = (p.filtros ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    tipo: r.tipo as TipoReporte,
    formato: r.formato as FormatoReporte,
    estado: r.status as EstadoReporte,
    nombre: r.name,
    solicitanteId: r.requested_by,
    solicitante: r.requested_by_name,
    fuente: r.source,
    corteUtc: r.corte,
    creadoUtc: r.created_at,
    iniciadoUtc: r.started_at,
    terminadoUtc: r.finished_at,
    expiraUtc: r.expires_at,
    filas: r.row_count,
    tamanoBytes: r.file_size,
    error: r.error,
    parametros: {
      tipo: (p.tipo as TipoReporte) ?? (r.tipo as TipoReporte),
      formato: (p.formato as FormatoReporte) ?? (r.formato as FormatoReporte),
      periodo: (p.periodo as PeriodoReporte) ?? "30d",
      desde: (p.desde as string) ?? "",
      hasta: (p.hasta as string) ?? "",
      zona: (p.zona as string) ?? "",
      magnitudMin: filtros.magnitud_min != null ? Number(filtros.magnitud_min) : null,
      reviewStatus: (filtros.review_status as EstadoRevision | undefined) ?? "",
    },
    historial: Array.isArray(p.historial)
      ? (p.historial as { estado: EstadoReporte; horaUtc: string }[])
      : derivarHistorial(r),
    descargaDisponible: r.descarga_disponible,
  };
}

function queryReportes(f: FiltrosReportes, pagina: number, tamano: number): string {
  const qs = new URLSearchParams();
  if (f.tipo) qs.set("tipo", f.tipo);
  if (f.estado) qs.set("estado", f.estado);
  if (f.solicitante) qs.set("solicitante", f.solicitante === "mios" ? "mios" : f.solicitante);
  qs.set("pagina", String(pagina));
  qs.set("tamano", String(tamano));
  return qs.toString();
}

const BASE_API = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

/* ════ Lectura ════ */

export function listarTipos(): TipoReporteInfo[] {
  return TIPOS;
}

export async function listarReportes(
  filtros: FiltrosReportes,
  pagina: number,
  tamano: number,
  _usuarioId?: string,
): Promise<PaginaReportes> {
  const data = await apiGet<ReportListAPI>(`/reports?${queryReportes(filtros, pagina, tamano)}`);
  return {
    filas: data.items.map(adaptarReporte),
    total: data.total,
    pagina: data.page,
    tamano: data.page_size,
    totalPaginas: Math.max(1, Math.ceil(data.total / data.page_size)),
  };
}

export async function obtenerReporte(id: string): Promise<Reporte | null> {
  try {
    return adaptarReporte(await apiGet<ReportOutAPI>(`/reports/${id}`));
  } catch {
    return null;
  }
}

/** Lista completa (sin paginar) para los modales de indicadores y segmentos. */
export async function listarSinPaginar(filtros: FiltrosReportes, _usuarioId?: string): Promise<Reporte[]> {
  const filas: Reporte[] = [];
  let pagina = 1;
  for (;;) {
    const data = await apiGet<ReportListAPI>(`/reports?${queryReportes(filtros, pagina, 100)}`);
    filas.push(...data.items.map(adaptarReporte));
    if (filas.length >= data.total || data.items.length === 0) return filas;
    pagina += 1;
  }
}

export async function resumenReportes(): Promise<ResumenReportes> {
  const data = await apiGet<ReportListAPI>("/reports?pagina=1&tamano=1");
  return {
    total: data.resumen.total,
    generados: data.resumen.generados,
    enProceso: data.resumen.en_proceso,
    fallidos: data.resumen.fallidos,
    porExpirar: data.resumen.por_expirar,
  };
}

export async function conteosTipoEstado(): Promise<ConteoTipoEstadoReporte[]> {
  const data = await apiGet<ReportListAPI>("/reports?pagina=1&tamano=1");
  return data.por_tipo_estado.map((c) => ({
    tipo: c.tipo as TipoReporte,
    nombre: c.tipo_label,
    estados: c.estados as Record<EstadoReporte, number>,
    total: c.total,
  }));
}

/** Personas que pueden figurar como solicitantes (usuarios reales). */
export async function opcionesSolicitantes(): Promise<{ value: string; label: string }[]> {
  const data = await apiGet<{ items: { id: string; full_name: string }[]; total: number }>(
    "/users?pagina=1&tamano=100&orden=nombre",
  );
  return [
    { value: "", label: "Todas las personas" },
    { value: "mios", label: "Mis informes" },
    ...data.items.map((u) => ({ value: u.id, label: u.full_name })),
  ];
}

/* ════ Creación ════ */

export async function crearReporte(parametros: ParametrosReporte, _usuario?: User): Promise<Reporte> {
  const creado = await apiPost<ReportOutAPI>("/reports", {
    tipo: parametros.tipo,
    formato: parametros.formato,
    periodo: parametros.periodo,
    desde: parametros.desde || null,
    hasta: parametros.hasta || null,
    zona: parametros.zona ? etiquetaZona(parametros.zona, REGION_OPTIONS) : null,
    filtros: {
      magnitud_min: parametros.magnitudMin,
      review_status: parametros.reviewStatus || null,
    },
  });
  return adaptarReporte(creado);
}

/* ════ Vista previa (antes de generar) ════ */

export interface VistaPrevia {
  disponible: boolean;
  filas: number;
  columnas: string[];
  muestras: (string | number)[][];
}

/**
 * Vista previa (antes de generar). El backend aún no expone un endpoint de
 * previsualización, así que se informa como "pendiente de backend" en vez de
 * mostrar filas inventadas.
 */
export function vistaPrevia(_parametros: ParametrosReporte): VistaPrevia {
  return { disponible: false, filas: 0, columnas: [], muestras: [] };
}

/* ════ Expiración y descarga ════ */

export function horasHastaExpirar(r: Reporte): number | null {
  if (r.estado !== "listo" || !r.expiraUtc) return null;
  return (Date.parse(r.expiraUtc) - Date.now()) / 3600_000;
}

export function estaExpirado(r: Reporte): boolean {
  if (r.estado === "expirado") return true;
  if (r.estado !== "listo" || !r.expiraUtc) return false;
  return Date.parse(r.expiraUtc) <= Date.now();
}

export function puedeDescargar(r: Reporte): boolean {
  if (r.descargaDisponible === false) return false;
  return r.estado === "listo" && !estaExpirado(r);
}

export type ResultadoDescarga = "descargado" | "copiado" | "expirado" | "no-listo" | "error";

export async function descargarReporte(r: Reporte): Promise<ResultadoDescarga> {
  if (r.estado !== "listo") return "no-listo";
  if (r.descargaDisponible === false) return "expirado";
  try {
    const res = await fetch(`${BASE_API}/reports/${r.id}/download`, { credentials: "include" });
    if (res.status === 410) return "expirado";
    if (!res.ok) return "error";
    const blob = await res.blob();
    downloadFile(nombreArchivo(r), blob, res.headers.get("content-type") ?? "application/octet-stream");
    return "descargado";
  } catch {
    return "error";
  }
}

/* ════ Metadatos, nombre y texto ════ */

export function periodoTexto(p: ParametrosReporte): string {
  if (p.periodo === "personalizado") {
    return p.desde && p.hasta ? `${p.desde} a ${p.hasta}` : "Rango personalizado";
  }
  return PERIODOS.find((x) => x.value === p.periodo)?.label ?? p.periodo;
}

export function filtrosTexto(p: ParametrosReporte): string {
  const partes: string[] = [];
  if (p.magnitudMin != null) partes.push(`magnitud ≥ ${p.magnitudMin.toFixed(1)}`);
  if (p.reviewStatus === "pendiente_validacion") partes.push("pendientes de validación");
  else if (p.reviewStatus === "observado") partes.push("observados");
  return partes.length ? partes.join(", ") : "sin filtros adicionales";
}

export function metadatosReporte(r: Reporte): [string, string][] {
  const p = r.parametros;
  return [
    ["Fecha de corte", fmtDateTimeUTC5(r.corteUtc)],
    ["Periodo", periodoTexto(p)],
    ["Zona", etiquetaZona(p.zona, REGION_OPTIONS)],
    ["Filtros", filtrosTexto(p)],
    ["Fuente", r.fuente],
    ["Solicitante", r.solicitante],
    ["Filas", r.filas != null ? String(r.filas) : "—"],
  ];
}

export function nombreArchivo(r: Reporte): string {
  const fecha = r.corteUtc.slice(0, 10);
  const slug = ETIQUETA_TIPO[r.tipo]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `informe_${slug}_${fecha}.${r.formato}`;
}
