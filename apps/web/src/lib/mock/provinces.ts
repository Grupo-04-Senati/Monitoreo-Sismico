import { PROV_BY_DEPT, type ProvPath } from "@/lib/geo/provPaths";

export interface ProvinceStat {
  name: string;
  path: ProvPath;
  n: number;
  mx: number;
}

export interface DistrictStat {
  name: string;
  n: number;
  mx: number;
}

/* PRNG determinista: mismos datos en cada render, sin backend */
function seedOf(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFor(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Reparte un total entero de forma proporcional, garantizando la suma exacta */
function distribute(total: number, weights: number[]): number[] {
  if (total <= 0 || weights.length === 0) return weights.map(() => 0);
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / sumW) * total);
  const out = raw.map((v) => Math.floor(v));
  let rest = total - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  let k = 0;
  while (rest > 0 && order.length > 0) {
    out[order[k % order.length].i] += 1;
    rest -= 1;
    k += 1;
  }
  return out;
}

export function provincesOf(regionSlug: string): ProvPath[] {
  return PROV_BY_DEPT[regionSlug]?.provincias ?? [];
}

export function deptNameOf(regionSlug: string): string {
  return PROV_BY_DEPT[regionSlug]?.name ?? "";
}

export interface ProvinceOption {
  name: string;
  deptSlug: string;
  deptName: string;
}

/** Índice plano de las 197 provincias (para el buscador del modal) */
export const ALL_PROVINCES: ProvinceOption[] = Object.entries(PROV_BY_DEPT)
  .flatMap(([deptSlug, dept]) =>
    dept.provincias.map((p) => ({ name: p.name, deptSlug, deptName: dept.name })),
  )
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

/** Busca una provincia por nombre exacto y devuelve su región */
export function findProvince(name: string): ProvinceOption | null {
  return ALL_PROVINCES.find((p) => p.name === name) ?? null;
}

/**
 * Distribuye los eventos de la región entre sus provincias (determinista).
 * La suma coincide siempre con el total de la región.
 */
export function provinceStats(regionSlug: string, total: number, maxMag: number): ProvinceStat[] {
  const list = provincesOf(regionSlug);
  if (list.length === 0) return [];
  const rnd = rngFor(seedOf(`prov|${regionSlug}`));
  const weights = list.map(() => 0.4 + rnd() * rnd() * 2.4 + rnd());
  const counts = distribute(total, weights);
  const lo = Math.min(3.0, maxMag);
  const top = counts.indexOf(Math.max(...counts));
  return list.map((p, i) => {
    const r = rngFor(seedOf(`mag|${regionSlug}|${p.name}`))();
    const mx = counts[i] === 0 ? 0 : Number((lo + r * (maxMag - lo)).toFixed(1));
    return { name: p.name, path: p, n: counts[i], mx: i === top && counts[i] > 0 ? maxMag : mx };
  });
}

const DISTRICT_POOL = [
  "San Juan", "San Pedro", "San Pablo", "San Miguel", "San Marcos", "San Agustín",
  "San Jerónimo", "San Isidro", "San Luis", "San Antonio", "San José", "San Rafael",
  "Santa Rosa", "Santa Cruz", "Santa María", "Santa Ana", "Santa Lucía", "Santa Bárbara",
  "La Victoria", "La Merced", "La Unión", "El Tambo", "El Carmen", "El Milagro",
  "Buenos Aires", "Vista Alegre", "Miraflores", "Palca", "Huancán", "Quichuay",
  "Paccha", "Chinchaypujio", "Cachimayo", "Poroy", "Santiago", "Cusipata",
  "Pillpinto", "Colquemarca", "Omacha", "Pampamarca", "Tinta", "Salas",
  "Quilcas", "Ingenio", "Sincos", "Muqui", "Masma", "Cullhuas",
  "Pucará", "Acolla", "Apata", "Huasahuasi", "Pomacocha", "Santo Domingo",
];

/**
 * Distritos afectados de una provincia (mock determinista).
 * Si la provincia no tiene eventos, devuelve la lista vacía.
 */
export function provinceDistricts(regionSlug: string, province: string, n: number, mx: number): DistrictStat[] {
  if (n <= 0) return [];
  const rnd = rngFor(seedOf(`dst|${regionSlug}|${province}`));
  const pool = [...DISTRICT_POOL];
  const count = 3 + Math.floor(rnd() * 4);
  const picked: string[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  }
  const counts = distribute(n, picked.map((name) => 0.3 + rngFor(seedOf(`w|${province}|${name}`))()));
  const lo = Math.min(3.0, mx);
  return picked
    .map((name, i) => ({
      name,
      n: counts[i],
      mx: counts[i] === 0 ? 0 : Number((lo + rngFor(seedOf(`d|${province}|${name}`))() * (mx - lo)).toFixed(1)),
    }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}
