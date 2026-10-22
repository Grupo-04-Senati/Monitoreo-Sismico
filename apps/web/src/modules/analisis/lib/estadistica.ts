/* ════════════════════════════════════════════════════════════════
   Estadística descriptiva pura para el módulo de Análisis estadístico.
   Sin dependencias de React ni del DOM: se puede probar de forma aislada.
   ════════════════════════════════════════════════════════════════ */

export function suma(a: number[]): number {
  return a.reduce((x, y) => x + y, 0);
}

export function media(a: number[]): number {
  return a.length ? suma(a) / a.length : NaN;
}

/** Cuantil por interpolación lineal (mismo método que el prototipo). */
export function cuantil(a: number[], p: number): number {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const i = (s.length - 1) * p;
  const l = Math.floor(i);
  return s[l] + (s[Math.min(l + 1, s.length - 1)] - s[l]) * (i - l);
}

/** Mediana: valor central; con n par, el promedio exacto de los dos centrales
    (sin redondear: con magnitudes, redondear a entero daba valores imposibles). */
export function mediana(a: number[]): number {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Desviación estándar muestral (n − 1). */
export function desviacion(a: number[]): number {
  if (a.length < 2) return NaN;
  const m = media(a);
  return Math.sqrt(suma(a.map((x) => (x - m) ** 2)) / (a.length - 1));
}

export function minimo(a: number[]): number {
  return a.length ? Math.min(...a) : NaN;
}

export function maximo(a: number[]): number {
  return a.length ? Math.max(...a) : NaN;
}

/** Rango con un 4 % de margen a cada lado (eje de dispersión). */
export function rangoConMargen(a: number[]): [number, number] {
  let lo = minimo(a);
  let hi = maximo(a);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.04;
  return [lo - pad, hi + pad];
}

/** Rangos con empates promediados (base de Spearman). */
export function rangos(a: number[]): number[] {
  const idx = a.map((v, i) => [v, i] as [number, number]).sort((x, y) => x[0] - y[0]);
  const r = new Array<number>(a.length).fill(0);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}

export function pearson(x: number[], y: number[]): number {
  if (x.length < 3 || x.length !== y.length) return NaN;
  const mx = media(x);
  const my = media(y);
  let a = 0;
  let b = 0;
  let c = 0;
  for (let i = 0; i < x.length; i++) {
    a += (x[i] - mx) * (y[i] - my);
    b += (x[i] - mx) ** 2;
    c += (y[i] - my) ** 2;
  }
  const d = Math.sqrt(b * c);
  return d ? a / d : NaN;
}

export function spearman(x: number[], y: number[]): number {
  return pearson(rangos(x), rangos(y));
}

export const fmt2 = (v: number): string => (Number.isFinite(v) ? v.toFixed(2) : "—");
export const fmt1 = (v: number): string => (Number.isFinite(v) ? v.toFixed(1) : "—");
