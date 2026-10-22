/* ════════════════════════════════════════════════════════════════
   Utilidades de catálogo compartidas (reales, sin datos de ejemplo).

   Filtros de periodo anclados en `/meta`, etiquetas de periodo, el catálogo
   de regiones y las derivaciones puras (series, buckets de magnitud,
   profundidad mediana). No genera eventos: opera sobre los que recibe.
   ════════════════════════════════════════════════════════════════ */

import type { MagnitudeBucket, SeismicEvent } from "@/types";

import { MON_SHORT, UTC5_MS as UTC5, dayKeyUTC5, fmtDayLabel, slugify } from "@/lib/format";
import { anclaMs } from "@/lib/ancla";

/* ════ Regiones (catálogo geográfico de referencia) ════ */

const REGION_NAMES = [
  "Amazonas",
  "Áncash",
  "Apurímac",
  "Arequipa",
  "Ayacucho",
  "Cajamarca",
  "Callao",
  "Cusco",
  "Huancavelica",
  "Huánuco",
  "Ica",
  "Junín",
  "La Libertad",
  "Lambayeque",
  "Lima",
  "Loreto",
  "Madre de Dios",
  "Moquegua",
  "Pasco",
  "Piura",
  "Puno",
  "San Martín",
  "Tacna",
  "Tumbes",
  "Ucayali",
];

export const REGION_OPTIONS = REGION_NAMES.map((name) => ({ slug: slugify(name), name })).sort((a, b) =>
  a.name.localeCompare(b.name, "es"),
);

/* ════ Filtros de periodo ════ */

function parseDay(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function periodBounds(periodo: string, desde?: string, hasta?: string): { start: number; end: number } {
  const now = anclaMs();
  switch (periodo) {
    case "24h":
      return { start: now - 24 * 3600_000, end: now };
    case "7d":
      return { start: now - 7 * 24 * 3600_000, end: now };
    case "custom": {
      let start = -Infinity;
      let end = Infinity;
      if (desde) start = parseDay(desde) - UTC5;
      if (hasta) end = parseDay(hasta) - UTC5 + 24 * 3600_000;
      if (start > end) [start, end] = [end, start];
      return { start, end };
    }
    default:
      return { start: now - 30 * 24 * 3600_000, end: now };
  }
}

export function periodLabel(periodo: string, desde?: string, hasta?: string): string {
  if (periodo === "24h") return "Últimas 24 h";
  if (periodo === "7d") return "Últimos 7 días";
  if (periodo === "custom") {
    if (!desde || !hasta) return "Todo el catálogo";
    const [d1, d2] = desde <= hasta ? [desde, hasta] : [hasta, desde];
    const y1 = d1.slice(0, 4);
    const y2 = d2.slice(0, 4);
    return y1 === y2
      ? `${fmtDayLabel(d1)} – ${fmtDayLabel(d2)} ${y2}`
      : `${fmtDayLabel(d1)} ${y1} – ${fmtDayLabel(d2)} ${y2}`;
  }
  return "Últimos 30 días";
}

/* ════ Filtros sobre un conjunto de eventos ════ */

export interface EventFilter {
  periodo?: string;
  desde?: string;
  hasta?: string;
  zona?: string;
}

export function filterEvents(events: SeismicEvent[], f: EventFilter = {}): SeismicEvent[] {
  const { start, end } = periodBounds(f.periodo ?? "30d", f.desde, f.hasta);
  return events.filter((e) => {
    const t = new Date(e.occurredAt).getTime();
    if (t < start || t > end) return false;
    if (f.zona && slugify(e.region) !== f.zona) return false;
    return true;
  });
}

export function inPeriod(iso: string, f: EventFilter = {}): boolean {
  const { start, end } = periodBounds(f.periodo ?? "30d", f.desde, f.hasta);
  const t = new Date(iso).getTime();
  return t >= start && t <= end;
}

/** Eventos del periodo inmediatamente anterior. Devuelve -1 si el catálogo no llega tan atrás. */
export function countPreviousPeriod(events: SeismicEvent[], f: EventFilter = {}, catStartIso?: string): number {
  const { start, end } = periodBounds(f.periodo ?? "30d", f.desde, f.hasta);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return -1;
  const span = end - start;
  const catStart = catStartIso
    ? new Date(catStartIso).getTime()
    : events.reduce((min, e) => Math.min(min, new Date(e.occurredAt).getTime()), Infinity);
  if (!Number.isFinite(catStart)) return -1;
  if (start - span < catStart) return -1;
  return events.filter((e) => {
    const t = new Date(e.occurredAt).getTime();
    if (t < start - span || t >= start) return false;
    if (f.zona && slugify(e.region) !== f.zona) return false;
    return true;
  }).length;
}

/* ════ Derivados del catálogo filtrado ════ */

/**
 * Eventos por día (UTC-5). Los días sin eventos del rango cuentan como 0: omitirlos
 * uniría con una línea días separados y parecería actividad constante (PDF §11).
 * `rango` es el del filtro (`periodBounds`); si no es finito, se usa el de los eventos.
 */
export function toTimeSeries(
  events: SeismicEvent[],
  rango?: { start: number; end: number },
): { label: string; value: number; key: string }[] {
  return groupTimeSeries(events, "day", rango);
}

export type TimeGranularity = "day" | "week" | "month";

function groupKeyUTC5(iso: string, gran: TimeGranularity): string {
  const day = dayKeyUTC5(iso);
  if (gran === "day") return day;
  const [y, m, d] = day.split("-").map(Number);
  if (gran === "month") return `${y}-${String(m).padStart(2, "0")}`;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const monday = new Date(Date.UTC(y, m - 1, d - ((dow + 6) % 7)));
  const mm = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(monday.getUTCDate()).padStart(2, "0");
  return `${monday.getUTCFullYear()}-${mm}-${dd}`;
}

function groupLabel(key: string, gran: TimeGranularity): string {
  if (gran === "month") {
    const [y, m] = key.split("-");
    return `${MON_SHORT[Number(m) - 1]} ${y.slice(2)}`;
  }
  return fmtDayLabel(key);
}

/** Máximo de periodos que se rellenan con 0 (≈ 27 años por día). */
const MAX_PERIODOS = 10_000;

/** Clave siguiente a `key` (día, lunes de la semana siguiente o mes siguiente). */
function siguienteClave(key: string, gran: TimeGranularity): string {
  if (gran === "month") {
    const [y, m] = key.split("-").map(Number);
    return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  const [y, m, d] = key.split("-").map(Number);
  const n = new Date(Date.UTC(y, m - 1, d + (gran === "week" ? 7 : 1)));
  return `${n.getUTCFullYear()}-${String(n.getUTCMonth() + 1).padStart(2, "0")}-${String(n.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Eventos agrupados por día, semana (lunes) o mes, en UTC-5. Los periodos sin
 * eventos del rango cuentan como 0 (ver `toTimeSeries`).
 */
export function groupTimeSeries(
  events: SeismicEvent[],
  granularity: TimeGranularity = "day",
  rango?: { start: number; end: number },
): { label: string; value: number; key: string }[] {
  const groups = new Map<string, number>();
  for (const e of events) {
    const k = groupKeyUTC5(e.occurredAt, granularity);
    groups.set(k, (groups.get(k) ?? 0) + 1);
  }
  const claves = [...groups.keys()].sort();
  const desde = rango && Number.isFinite(rango.start) ? groupKeyUTC5(new Date(rango.start).toISOString(), granularity) : claves[0];
  // `end` es exclusivo en los periodos por día: se toma el instante anterior.
  const hasta = rango && Number.isFinite(rango.end) ? groupKeyUTC5(new Date(rango.end - 1).toISOString(), granularity) : claves[claves.length - 1];
  if (!desde || !hasta) return [];

  const serie: { label: string; value: number; key: string }[] = [];
  for (let k = desde; k <= hasta; k = siguienteClave(k, granularity)) {
    if (serie.length >= MAX_PERIODOS) {
      // Periodo enorme para esta agrupación: solo los periodos con eventos (sin recortar en silencio).
      return claves.map((c) => ({ label: groupLabel(c, granularity), value: groups.get(c) ?? 0, key: c }));
    }
    serie.push({ label: groupLabel(k, granularity), value: groups.get(k) ?? 0, key: k });
  }
  return serie;
}

const MAG_RANGES = ["2.0–2.9", "3.0–3.9", "4.0–4.9", "5.0–5.9", "6.0+"];

export function toMagnitudeBuckets(events: SeismicEvent[]): MagnitudeBucket[] {
  const counts = [0, 0, 0, 0, 0];
  for (const e of events) {
    const b = Math.floor(e.magnitude);
    counts[b <= 2 ? 0 : b === 3 ? 1 : b === 4 ? 2 : b === 5 ? 3 : 4] += 1;
  }
  return MAG_RANGES.map((range, i) => ({ range, count: counts[i] }));
}

/** Profundidad mediana (km). Ignora eventos sin profundidad, como el módulo de Eventos. */
export function medianDepth(events: SeismicEvent[]): number | null {
  const ds = events
    .map((e) => e.depthKm)
    .filter((v): v is number => v != null && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!ds.length) return null;
  const mid = Math.floor(ds.length / 2);
  const m = ds.length % 2 ? ds[mid] : (ds[mid - 1] + ds[mid]) / 2;
  return Math.round(m * 10) / 10; // un decimal, como la profundidad media
}

export function meanDepth(events: SeismicEvent[]): number | null {
  const ds = events
    .map((e) => e.depthKm)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (!ds.length) return null;
  return Math.round((ds.reduce((a, b) => a + b, 0) / ds.length) * 10) / 10;
}

export function maxMagnitudeEvent(events: SeismicEvent[]): SeismicEvent | null {
  let max: SeismicEvent | null = null;
  for (const e of events) if (!max || e.magnitude > max.magnitude) max = e;
  return max;
}
