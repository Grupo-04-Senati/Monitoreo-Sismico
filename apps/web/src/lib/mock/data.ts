import type { SeismicEvent, DataSource, AlertItem, MagnitudeBucket } from "@/types";

/* ════ Referencia temporal del mock (sin fechas futuras) ════ */
export const NOW = new Date("2026-10-15T14:35:00Z");
export const DATA_RANGE_LABEL = "16 sep – 15 oct 2026";
export const DATA_MIN_DAY = "2026-09-16";
export const DATA_MAX_DAY = "2026-10-15";

const UTC5 = -5 * 60 * 60 * 1000;
const MON_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/* ════ Fechas siempre en zona UTC-5 (Perú) ════ */
const toUTC5 = (iso: string) => new Date(new Date(iso).getTime() + UTC5);

export function fmtDateUTC5(iso: string): string {
  const d = toUTC5(iso);
  return `${d.getUTCDate()} ${MON_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtDateTimeUTC5(iso: string): string {
  const d = toUTC5(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${fmtDateUTC5(iso)}, ${hh}:${mm}`;
}

export function dayKeyUTC5(iso: string): string {
  const d = toUTC5(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

function fmtDayLabel(dayKey: string): string {
  const [, m, d] = dayKey.split("-");
  return `${d} ${MON_SHORT[Number(m) - 1]}`;
}

/** "2026-10-01" → "1 oct 2026" (para tooltips) */
export function fmtDayLong(dayKey: string): string {
  const [y, m, d] = dayKey.split("-");
  return `${Number(d)} ${MON_SHORT[Number(m) - 1]} ${y}`;
}

/** "…T14:35:00Z" → "09:35" (hora local UTC-5) */
export function fmtTimeUTC5(iso: string): string {
  const d = toUTC5(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/* ════ Fuentes: una única fuente de datos (IGP) ════ */
interface SourceMeta {
  id: string;
  short: string;
  fullName: string;
  prefix: string;
  url: string;
}

const SOURCE_META: SourceMeta[] = [
  { id: "src-igp", short: "IGP", fullName: "IGP – Instituto Geofísico del Perú", prefix: "IGP", url: "https://www.igp.gob.pe/" },
];

/* ════ Puntos de referencia (texto) para ubicar eventos ════ */
interface Anchor {
  slug: string;
  city: string;
  dept: string;
  w: number;
}

const ANCHORS: Anchor[] = [
  { slug: "lima", city: "Lima", dept: "Lima", w: 2 },
  { slug: "callao", city: "Callao", dept: "Callao", w: 1.2 },
  { slug: "arequipa", city: "Arequipa", dept: "Arequipa", w: 2 },
  { slug: "cusco", city: "Cusco", dept: "Cusco", w: 1.6 },
  { slug: "junin", city: "Huancayo", dept: "Junín", w: 1.6 },
  { slug: "huanuco", city: "Huánuco", dept: "Huánuco", w: 1.8 },
  { slug: "san_martin", city: "Moyobamba", dept: "San Martín", w: 1 },
  { slug: "tumbes", city: "Tumbes", dept: "Tumbes", w: 0.8 },
  { slug: "tacna", city: "Tacna", dept: "Tacna", w: 1 },
  { slug: "piura", city: "Piura", dept: "Piura", w: 1.2 },
  { slug: "cajamarca", city: "Cajamarca", dept: "Cajamarca", w: 1.2 },
  { slug: "ancash", city: "Huaraz", dept: "Áncash", w: 1.5 },
  { slug: "ica", city: "Ica", dept: "Ica", w: 1.4 },
  { slug: "loreto", city: "Iquitos", dept: "Loreto", w: 1 },
  { slug: "puno", city: "Puno", dept: "Puno", w: 1 },
  { slug: "ayacucho", city: "Ayacucho", dept: "Ayacucho", w: 1.2 },
  { slug: "ucayali", city: "Atalaya", dept: "Ucayali", w: 0.8 },
  { slug: "madre_de_dios", city: "Tambopata", dept: "Madre de Dios", w: 0.7 },
  { slug: "moquegua", city: "Moquegua", dept: "Moquegua", w: 0.8 },
  { slug: "lambayeque", city: "Chiclayo", dept: "Lambayeque", w: 1 },
  { slug: "la_libertad", city: "Trujillo", dept: "La Libertad", w: 1.2 },
  { slug: "amazonas", city: "Chachapoyas", dept: "Amazonas", w: 0.8 },
  { slug: "apurimac", city: "Abancay", dept: "Apurímac", w: 1 },
  { slug: "huancavelica", city: "Huancavelica", dept: "Huancavelica", w: 1 },
  { slug: "pasco", city: "Cerro de Pasco", dept: "Pasco", w: 1 },
];

function pickAnchor(rnd: () => number): Anchor {
  const total = ANCHORS.reduce((s, a) => s + a.w, 0);
  let x = rnd() * total;
  for (const a of ANCHORS) {
    x -= a.w;
    if (x <= 0) return a;
  }
  return ANCHORS[0];
}

const DIRS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

/* ════ PRNG determinista (dataset estable entre recargas) ════ */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ════ Eventos destacados (editados a mano) ════ */
const HANDCRAFTED: SeismicEvent[] = [
  {
    id: "evt-001", externalId: "IGP-2026-001", sourceId: "src-igp", sourceName: "IGP",
    occurredAt: "2026-10-15T14:23:00Z",
    magnitude: 4.2, magnitudeType: "Mw", depthKm: 28, place: "12 km al SO de Callao",
    region: "Lima", sourceUrl: "https://www.igp.gob.pe/",
    receivedAt: "2026-10-15T14:25:12Z", status: "observed",
  },
  {
    id: "evt-002", externalId: "IGP-2026-002", sourceId: "src-igp", sourceName: "IGP",
    occurredAt: "2026-10-15T09:11:00Z",
    magnitude: 3.8, magnitudeType: "Mw", depthKm: 112, place: "35 km al SE de Arequipa",
    region: "Arequipa", sourceUrl: "https://www.igp.gob.pe/",
    receivedAt: "2026-10-15T09:13:45Z", status: "observed",
  },
  {
    id: "evt-003", externalId: "IGP-2026-003", sourceId: "src-igp", sourceName: "IGP",
    occurredAt: "2026-10-14T22:47:00Z",
    magnitude: 5.1, magnitudeType: "Mw", depthKm: 15, place: "28 km al NO de Huánuco",
    region: "Huánuco", sourceUrl: "https://www.igp.gob.pe/",
    receivedAt: "2026-10-14T22:49:30Z", status: "observed",
  },
  {
    id: "evt-004", externalId: "IGP-2026-004", sourceId: "src-igp", sourceName: "IGP",
    occurredAt: "2026-10-14T18:03:00Z",
    magnitude: 4.5, magnitudeType: "Mw", depthKm: 56, place: "19 km al SO de Tacna",
    region: "Tacna", sourceUrl: "https://www.igp.gob.pe/",
    receivedAt: "2026-10-14T18:06:00Z", status: "pending_review",
  },
  {
    id: "evt-005", externalId: "IGP-2026-005", sourceId: "src-igp", sourceName: "IGP",
    occurredAt: "2026-10-13T11:30:00Z",
    magnitude: 3.2, magnitudeType: "ML", depthKm: 89, place: "42 km al E de Moyobamba",
    region: "San Martín", sourceUrl: "https://www.igp.gob.pe/",
    receivedAt: "2026-10-13T11:32:18Z", status: "observed",
  },
  {
    id: "evt-006", externalId: "IGP-2026-006", sourceId: "src-igp", sourceName: "IGP",
    occurredAt: "2026-10-12T07:55:00Z",
    magnitude: 4.9, magnitudeType: "Mw", depthKm: 22, place: "55 km al SO de Tumbes",
    region: "Tumbes", sourceUrl: "https://www.igp.gob.pe/",
    receivedAt: "2026-10-12T07:57:55Z", status: "observed",
  },
  {
    id: "evt-007", externalId: "IGP-2026-007", sourceId: "src-igp", sourceName: "IGP",
    occurredAt: "2026-10-11T16:40:00Z",
    magnitude: 3.5, magnitudeType: "ML", depthKm: 210, place: "8 km al N de Satipo",
    region: "Junín", sourceUrl: "https://www.igp.gob.pe/",
    receivedAt: "2026-10-11T16:42:44Z", status: "observed",
  },
  {
    id: "evt-008", externalId: "IGP-2026-008", sourceId: "src-igp", sourceName: "IGP",
    occurredAt: "2026-10-10T03:12:00Z",
    magnitude: 5.8, magnitudeType: "Mw", depthKm: 101, place: "48 km al NO de Arequipa",
    region: "Arequipa", sourceUrl: "https://www.igp.gob.pe/",
    receivedAt: "2026-10-10T03:14:52Z", status: "observed",
  },
];

/* Eventos destacados por día local (UTC-5), para no duplicar conteos */
const HAND_BY_DAY: Record<string, number> = {
  "2026-10-09": 1,
  "2026-10-11": 1,
  "2026-10-12": 1,
  "2026-10-13": 1,
  "2026-10-14": 2,
  "2026-10-15": 2,
};

/* Catálogo diario 16 sep – 15 oct 2026: 30 días (480 eventos),
   para que "Últimos 30 días" muestre exactamente 30 barras */
const DAY_COUNTS = [
  14, 11, 9, 17, 21, 13, 10, 16, 25, 19, 12, 8, 15, 23, 18, // 16–30 sep
  12, 8, 15, 11, 22, 18, 9, 14, 27, 31, 16, 13, 19, 24, 10, // 01–15 oct
];

function dayKeyAt(i: number): string {
  const d = new Date(Date.UTC(2026, 8, 16) + i * 24 * 3600_000);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

function buildCatalog(): SeismicEvent[] {
  const rnd = mulberry32(20261015);
  const events: SeismicEvent[] = [...HANDCRAFTED];
  let seq = 100;

  DAY_COUNTS.forEach((count, i) => {
    const day = dayKeyAt(i);
    const n = count - (HAND_BY_DAY[day] ?? 0);
    const [y, m, d] = day.split("-").map(Number);
    const dayStart = Date.UTC(y, m - 1, d) - UTC5;
    const dayEnd = day === DATA_MAX_DAY ? NOW.getTime() : dayStart + 24 * 3600_000;

    for (let j = 0; j < n; j++) {
      const occurred = dayStart + Math.floor(rnd() * (dayEnd - dayStart));
      const occurredIso = new Date(occurred).toISOString();
      const receivedIso = new Date(occurred + (45 + Math.floor(rnd() * 160)) * 1000).toISOString();

      const src = SOURCE_META[0];
      const anchor = pickAnchor(rnd);

      const mBand = rnd();
      let mag: number;
      if (mBand < 0.57) mag = 2 + rnd();
      else if (mBand < 0.92) mag = 3 + rnd();
      else if (mBand < 0.98) mag = 4 + rnd();
      else mag = 5 + Math.min(rnd(), 0.6);
      mag = Math.round(mag * 10) / 10;

      const depth = Math.round(4 + Math.pow(rnd(), 3.4) * 300);

      const s = rnd();
      const status: SeismicEvent["status"] =
        s < 0.9 ? "observed" : s < 0.97 ? "pending_review" : s < 0.99 ? "experimental" : "official_comm";

      const num = seq++;
      events.push({
        id: `evt-${String(num).padStart(3, "0")}`,
        externalId: `${src.prefix}-2026-${String(num).padStart(3, "0")}`,
        sourceId: src.id,
        sourceName: src.short,
        occurredAt: occurredIso,
        magnitude: mag,
        magnitudeType: mag >= 4.5 ? "Mw" : rnd() < 0.5 ? "Mw" : "ML",
        depthKm: depth,
        place: `${3 + Math.floor(rnd() * 60)} km al ${DIRS[Math.floor(rnd() * DIRS.length)]} de ${anchor.city}`,
        region: anchor.dept,
        sourceUrl: src.url,
        receivedAt: receivedIso,
        status,
      });
    }
  });

  return events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export const mockEvents: SeismicEvent[] = buildCatalog();

/* ════ Fuente (registros de hoy derivados del catálogo) ════ */
const todayKey = dayKeyUTC5(NOW.toISOString());

export const mockSources: DataSource[] = SOURCE_META.map((s) => ({
  id: s.id,
  name: s.fullName,
  organization: s.short,
  status: "online",
  lastSyncAt: "2026-10-15T14:30:00Z",
  latencyMs: 320,
  recordsToday: mockEvents.filter((e) => e.sourceId === s.id && dayKeyUTC5(e.occurredAt) === todayKey).length,
}));

/* ════ Alertas: sísmicas vs avisos del sistema ════ */
export const mockAlerts: AlertItem[] = [
  {
    id: "alert-001", kind: "seismic",
    title: "Sismo M4.2 registrado en Callao",
    message: "Evento observado a 12 km al SO de Callao. Magnitud 4.2 Mw. Fuente: IGP.",
    severity: "info", status: "sent", createdAt: "2026-10-15T14:25:00Z",
    channel: "email", destination: "operadores@sismo.pe",
  },
  {
    id: "alert-002", kind: "seismic",
    title: "Sismo M5.8 en Arequipa",
    message: "Evento observado a 48 km al NO de Arequipa. Magnitud 5.8 Mw. Fuente: IGP.",
    severity: "warning", status: "sent", createdAt: "2026-10-10T03:15:00Z",
    channel: "webhook", destination: "https://hooks.sismo.pe/alerts",
  },
  {
    id: "alert-003", kind: "operational",
    title: "Sincronización IGP completada",
    message: `Se procesaron ${mockSources[0].recordsToday} ${mockSources[0].recordsToday === 1 ? "registro nuevo" : "registros nuevos"} sin duplicados.`,
    severity: "info", status: "sent", createdAt: "2026-10-15T14:30:00Z",
    channel: "internal", destination: "sistema",
  },
];

/* ════ Filtros de periodo/zona ════ */
export interface EventFilter {
  periodo?: string;
  desde?: string;
  hasta?: string;
  zona?: string;
}

function parseDay(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function periodBounds(periodo: string, desde?: string, hasta?: string): { start: number; end: number } {
  const now = NOW.getTime();
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

/** Eventos del periodo inmediatamente anterior. Devuelve -1 si el catálogo no llega tan atrás (sin comparación fiable). */
export function countPreviousPeriod(events: SeismicEvent[], f: EventFilter = {}): number {
  const { start, end } = periodBounds(f.periodo ?? "30d", f.desde, f.hasta);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return -1;
  const span = end - start;
  const catStart = new Date(mockEvents[mockEvents.length - 1].occurredAt).getTime();
  if (start - span < catStart) return -1;
  return events.filter((e) => {
    const t = new Date(e.occurredAt).getTime();
    if (t < start - span || t >= start) return false;
    if (f.zona && slugify(e.region) !== f.zona) return false;
    return true;
  }).length;
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

/* ════ Derivados del catálogo filtrado ════ */
export function toTimeSeries(events: SeismicEvent[]): { label: string; value: number; key: string }[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    const k = dayKeyUTC5(e.occurredAt);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ label: fmtDayLabel(k), value: v, key: k }));
}

/* ════ Agrupación por día / semana (lunes) / mes ════ */
export type TimeGranularity = "day" | "week" | "month";

function groupKeyUTC5(iso: string, gran: TimeGranularity): string {
  const day = dayKeyUTC5(iso);
  if (gran === "day") return day;
  const [y, m, d] = day.split("-").map(Number);
  if (gran === "month") return `${y}-${String(m).padStart(2, "0")}`;
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=domingo
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

export function groupTimeSeries(
  events: SeismicEvent[],
  granularity: TimeGranularity = "day",
): { label: string; value: number; key: string }[] {
  const groups = new Map<string, number>();
  for (const e of events) {
    const k = groupKeyUTC5(e.occurredAt, granularity);
    groups.set(k, (groups.get(k) ?? 0) + 1);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ label: groupLabel(k, granularity), value: v, key: k }));
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

export function medianDepth(events: SeismicEvent[]): number | null {
  if (!events.length) return null;
  const ds = events.map((e) => e.depthKm).sort((a, b) => a - b);
  const mid = Math.floor(ds.length / 2);
  return ds.length % 2 ? ds[mid] : Math.round((ds[mid - 1] + ds[mid]) / 2);
}

export function maxMagnitudeEvent(events: SeismicEvent[]): SeismicEvent | null {
  let max: SeismicEvent | null = null;
  for (const e of events) if (!max || e.magnitude > max.magnitude) max = e;
  return max;
}

/** Eventos del catálogo con los filtros globales aplicados. */
export function getEvents(f: EventFilter = {}): SeismicEvent[] {
  return filterEvents(mockEvents, f);
}

/** Regiones (texto) presentes en el catálogo, para el filtro global. */
export const REGION_OPTIONS = [...new Set(mockEvents.map((e) => e.region))]
  .map((name) => ({ slug: slugify(name), name }))
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

/* ════ Mock users para login ════ */
import type { User } from "@/types/auth";

export const mockUsers: (User & { password: string })[] = [
  {
    id: "u-001", fullName: "Ana García", email: "admin@sismo.pe", password: "Admin123!",
    role: "admin", status: "active", createdAt: "2026-01-15T10:00:00Z", lastLoginAt: "2026-10-15T09:00:00Z",
  },
  {
    id: "u-002", fullName: "Carlos Ruiz", email: "analista@sismo.pe", password: "Analista123!",
    role: "analyst", status: "active", createdAt: "2026-02-20T10:00:00Z", lastLoginAt: "2026-10-14T16:30:00Z",
  },
  {
    id: "u-003", fullName: "María Torres", email: "operador@sismo.pe", password: "Operador123!",
    role: "alert_operator", status: "active", createdAt: "2026-03-10T10:00:00Z", lastLoginAt: "2026-10-15T08:00:00Z",
  },
  {
    id: "u-004", fullName: "Pedro López", email: "auditor@sismo.pe", password: "Auditor123!",
    role: "auditor", status: "active", createdAt: "2026-04-05T10:00:00Z", lastLoginAt: "2026-10-13T12:00:00Z",
  },
  {
    id: "u-005", fullName: "Lucía Mendoza", email: "lucia.mendoza@sismo.pe", password: "Demo1234!",
    role: "viewer", status: "active", createdAt: "2026-05-12T10:00:00Z", lastLoginAt: "2026-10-14T09:20:00Z",
  },
  {
    id: "u-006", fullName: "Jorge Ríos", email: "jorge.rios@sismo.pe", password: "Demo1234!",
    role: "analyst", status: "active", createdAt: "2026-06-01T10:00:00Z", lastLoginAt: "2026-10-15T08:45:00Z",
  },
  {
    id: "u-007", fullName: "Carmen Aguilar", email: "carmen.aguilar@sismo.pe", password: "Demo1234!",
    role: "admin", status: "active", createdAt: "2026-06-18T10:00:00Z", lastLoginAt: "2026-10-15T07:55:00Z",
  },
  {
    id: "u-008", fullName: "Diego Salas", email: "diego.salas@sismo.pe", password: "Demo1234!",
    role: "alert_operator", status: "pending", createdAt: "2026-08-22T10:00:00Z",
  },
  {
    id: "u-009", fullName: "Rosa Vega", email: "rosa.vega@sismo.pe", password: "Demo1234!",
    role: "viewer", status: "suspended", createdAt: "2026-09-03T10:00:00Z", lastLoginAt: "2026-09-30T15:10:00Z",
  },
];
