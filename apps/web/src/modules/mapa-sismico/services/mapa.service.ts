import { cargarCatalogo } from "@/modules/eventos/services/eventos.service";
import { REGION_OPTIONS, periodBounds } from "@/lib/catalogo";
import { fmtDateTimeUTC5, slugify } from "@/lib/format";
import { downloadFile } from "@/lib/export";
import { buildXlsx, type XlsxSheet } from "@/lib/xlsx";
import { ETIQUETA_ESTADO } from "../schemas/filtros.schema";
import { haversineKm } from "../lib/geo";
import type { EventoSismico, FiltrosMapa, RegionResumen } from "../types";

/* ════════════════════════════════════════════════════════════════
   Acceso a datos del módulo de mapa. Deriva del catálogo real de Eventos
   (`GET /api/v1/events`), de modo que los conteos coinciden con la tabla.
   ════════════════════════════════════════════════════════════════ */

/** Catálogo de eventos del mapa (siempre la API), sin filtrar. */
export async function cargarEventosMapa(): Promise<EventoSismico[]> {
  return cargarCatalogo();
}

/** Eventos que cumplen los filtros del mapa (periodo, región, magnitud, estado, radio). */
export function eventosFiltrados(catalogo: EventoSismico[], f: FiltrosMapa): EventoSismico[] {
  const { start, end } = periodBounds(f.periodo || "30d", f.desde, f.hasta);
  const radio = f.rlat != null && f.rlon != null && f.radioKm != null;

  return catalogo.filter((e) => {
    const t = new Date(e.occurredAtUtc).getTime();
    if (t < start || t > end) return false;
    if (f.region && slugify(e.region) !== f.region) return false;
    if (f.magnitudMin != null && e.magnitude < f.magnitudMin) return false;
    if (f.magnitudMax != null && e.magnitude > f.magnitudMax) return false;
    if (f.estado && e.reviewStatus !== f.estado) return false;
    if (radio && haversineKm(f.rlat as number, f.rlon as number, e.latitude, e.longitude) > (f.radioKm as number)) return false;
    return true;
  });
}

/** Resumen por región para la tabla lateral (siempre las 25 regiones). */
export function resumirRegiones(eventos: EventoSismico[]): RegionResumen[] {
  const total = eventos.length;
  return REGION_OPTIONS.map((r) => {
    const del = eventos.filter((e) => slugify(e.region) === r.slug);
    const maxima = del.reduce((m, e) => Math.max(m, e.magnitude), Number.NEGATIVE_INFINITY);
    return {
      slug: r.slug,
      nombre: r.name,
      eventos: del.length,
      porcentaje: total > 0 ? (del.length / total) * 100 : 0,
      magnitudMaxima: del.length > 0 ? maxima : null,
    };
  }).sort((a, b) => b.eventos - a.eventos || a.nombre.localeCompare(b.nombre, "es"));
}

/* ════ Filas para tablas y exportación ════ */

export const COLS_REGIONES = ["Región", "Eventos", "% del total", "Magnitud máxima"];

export function filasRegiones(regiones: RegionResumen[]): (string | number)[][] {
  return regiones.map((r) => [r.nombre, r.eventos, `${r.porcentaje.toFixed(1)}%`, r.magnitudMaxima != null ? r.magnitudMaxima.toFixed(1) : "—"]);
}

export const COLS_EVENTOS_EXPORT = [
  "Fecha y hora (UTC-5)",
  "Localidad",
  "Región",
  "Magnitud",
  "Tipo",
  "Profundidad (km)",
  "Estado",
  "Latitud",
  "Longitud",
  "ID",
];

export function filasEventosExport(eventos: EventoSismico[]): (string | number)[][] {
  return [...eventos]
    .sort((a, b) => b.occurredAtUtc.localeCompare(a.occurredAtUtc))
    .map((e) => [
      fmtDateTimeUTC5(e.occurredAtUtc),
      e.locality,
      e.region,
      e.magnitude.toFixed(1),
      e.magnitudeType ?? "—",
      e.depthKm ?? "—",
      ETIQUETA_ESTADO[e.reviewStatus],
      e.latitude.toFixed(4),
      e.longitude.toFixed(4),
      e.id,
    ]);
}

/* ════ Exportación por partes (regiones / eventos) ════ */

export type FormatoExport = "csv" | "xlsx";
export type ParteMapa = "regiones" | "eventos";

export const PARTES_EXPORT: { id: ParteMapa; label: string }[] = [
  { id: "regiones", label: "Tabla de regiones (25 departamentos)" },
  { id: "eventos", label: "Eventos filtrados" },
];

function celda(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Descarga las partes elegidas (regiones y/o eventos) en CSV o Excel. */
export function descargarMapa(partes: ParteMapa[], regiones: RegionResumen[], eventos: EventoSismico[], formato: FormatoExport): void {
  const incluyeRegiones = partes.includes("regiones");
  const incluyeEventos = partes.includes("eventos");

  if (formato === "xlsx") {
    const hojas: XlsxSheet[] = [];
    if (incluyeRegiones) hojas.push({ name: "Regiones", cols: COLS_REGIONES, rows: filasRegiones(regiones) });
    if (incluyeEventos) hojas.push({ name: "Eventos", cols: COLS_EVENTOS_EXPORT, rows: filasEventosExport(eventos) });
    if (hojas.length === 0) return;
    downloadFile("mapa_sismico_export.xlsx", buildXlsx(hojas));
    return;
  }

  const bloques: string[] = [];
  if (incluyeRegiones) {
    bloques.push(
      ["Regiones", ...COLS_REGIONES].map(celda).join(";"),
      ...filasRegiones(regiones).map((f) => f.map(celda).join(";")),
    );
  }
  if (incluyeEventos) {
    if (bloques.length > 0) bloques.push("");
    bloques.push(["Eventos", ...COLS_EVENTOS_EXPORT].map(celda).join(";"), ...filasEventosExport(eventos).map((f) => f.map(celda).join(";")));
  }
  if (bloques.length === 0) return;
  downloadFile("mapa_sismico_export.csv", "\uFEFF" + bloques.join("\r\n"), "text/csv;charset=utf-8");
}
