/* ════════════════════════════════════════════════════════════════
   Formateo y constantes compartidas.

   Las fechas se presentan siempre en la zona horaria del Perú (UTC-5).
   ════════════════════════════════════════════════════════════════ */

/** Desplazamiento de Perú (UTC-5) en milisegundos. */
export const UTC5_MS = -5 * 60 * 60 * 1000;

/** Abreviaturas de mes en español. */
export const MON_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const toUTC5 = (iso: string) => new Date(new Date(iso).getTime() + UTC5_MS);

/** "2026-10-15T…Z" → "15 oct 2026" */
export function fmtDateUTC5(iso: string): string {
  const d = toUTC5(iso);
  return `${d.getUTCDate()} ${MON_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "2026-10-15T14:23:00Z" → "15 oct 2026, 09:23" */
export function fmtDateTimeUTC5(iso: string): string {
  const d = toUTC5(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${fmtDateUTC5(iso)}, ${hh}:${mm}`;
}

/** "2026-10-15T…Z" → "2026-10-15" (clave de día en UTC-5) */
export function dayKeyUTC5(iso: string): string {
  const d = toUTC5(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

/** "2026-10-01" → "1 oct" */
export function fmtDayLabel(dayKey: string): string {
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

/** "Áncash" → "ancash" (sin acentos, para slugs de URL). */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}
