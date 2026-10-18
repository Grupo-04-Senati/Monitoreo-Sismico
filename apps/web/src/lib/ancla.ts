/* ════════════════════════════════════════════════════════════════
   Ancla temporal y rango del catálogo.

   `NOW` es la referencia con la que se calculan los periodos (24h/7d/30d).
   `DATA_MIN_DAY`/`DATA_MAX_DAY`/`DATA_RANGE_LABEL` son el rango real del
   catálogo, servidos por `GET /meta`. No contiene valores de ejemplo: solo
   refleja lo que reporta la API.
   ════════════════════════════════════════════════════════════════ */

import { fmtDayLabel } from "@/lib/format";

/** Referencia temporal vigente. */
export let NOW: Date = new Date();

/** Rango real del catálogo (días locales UTC-5). */
export let DATA_MIN_DAY = "";
export let DATA_MAX_DAY = "";
export let DATA_RANGE_LABEL = "";

/** Última sincronización de la fuente, si la API la reporta. */
export let LAST_SYNC_AT: string | null = null;

export interface MetaInfo {
  data_min_day: string | null;
  data_max_day: string | null;
  last_sync_at: string | null;
}

function rangoLabel(min: string, max: string): string {
  if (!min || !max) return "";
  const [d1, d2] = min <= max ? [min, max] : [max, min];
  const y1 = d1.slice(0, 4);
  const y2 = d2.slice(0, 4);
  return y1 === y2
    ? `${fmtDayLabel(d1)} – ${fmtDayLabel(d2)} ${y2}`
    : `${fmtDayLabel(d1)} ${y1} – ${fmtDayLabel(d2)} ${y2}`;
}

/** Referencia temporal en milisegundos (reloj real). */
export function anclaMs(): number {
  return Date.now();
}

/** Aplica los metadatos de `GET /meta`. */
export function aplicarMeta(meta: MetaInfo): void {
  NOW = new Date(anclaMs());
  DATA_MIN_DAY = meta.data_min_day ?? "";
  DATA_MAX_DAY = meta.data_max_day ?? "";
  DATA_RANGE_LABEL = rangoLabel(DATA_MIN_DAY, DATA_MAX_DAY);
  LAST_SYNC_AT = meta.last_sync_at ?? null;
}
