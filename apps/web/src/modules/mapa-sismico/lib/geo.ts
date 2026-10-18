import { REGION_OPTIONS } from "@/lib/catalogo";
import { slugify } from "@/lib/format";
import type { Coord, FormaRegion, GeoRegiones } from "../types";

/* ════════════════════════════════════════════════════════════════
   Utilidades geográficas del módulo de mapa.

   No hay proveedor de mapas ni dependencias geoespaciales: el módulo
   interpreta el GeoJSON que carga el usuario y proyecta las coordenadas a
   un plano SVG (equirectangular corregido por latitud). NUNCA genera
   contornos de regiones por cuenta propia: sin archivo no dibuja nada.
   ════════════════════════════════════════════════════════════════ */

/** Palabras que no distinguen una región (se ignoran al emparejar nombres). */
const PALABRAS_VACIAS = new Set([
  "departamento",
  "region",
  "provincia",
  "constitucional",
  "del",
  "de",
  "la",
  "el",
  "los",
  "las",
]);

/** Alias de nombres conocidos que no coinciden por sí solos. */
const ALIAS: Record<string, string> = {
  prov_const_del_callao: "callao",
  provincia_constitucional_del_callao: "callao",
  prov_const_callao: "callao",
};

/** Diccionario `nombre normalizado → nombre canónico` de los 25 departamentos. */
const CANONICO: Record<string, string> = (() => {
  const mapa: Record<string, string> = {};
  for (const r of REGION_OPTIONS) mapa[normalizar(r.name)] = r.name;
  return mapa;
})();

function normalizar(nombre: string): string {
  return slugify(nombre)
    .split("_")
    .filter((p) => p && !PALABRAS_VACIAS.has(p))
    .join("_");
}

/** Empareja un nombre crudo del GeoJSON con una de las 25 regiones (o `null`). */
export function emparejarRegion(crudo: string): string | null {
  const n = normalizar(crudo);
  if (ALIAS[n]) return CANONICO[ALIAS[n]] ?? null;
  return CANONICO[n] ?? null;
}

/* ════ Interpretación del GeoJSON ════ */

interface GeoFeatureLike {
  geometry?: unknown;
  properties?: Record<string, unknown> | null;
}

function featuresDe(data: unknown): GeoFeatureLike[] {
  if (!data || typeof data !== "object") return [];
  const obj = data as { type?: string; features?: unknown; geometry?: unknown; properties?: unknown };
  if (obj.type === "FeatureCollection" && Array.isArray(obj.features)) {
    return obj.features as GeoFeatureLike[];
  }
  if (obj.type === "Feature") return [{ geometry: obj.geometry, properties: (obj.properties as Record<string, unknown>) ?? null }];
  if (typeof obj.type === "string" && obj.type !== "GeometryCollection") return [{ geometry: obj, properties: null }];
  return [];
}

function anillosDe(coords: unknown): Coord[][] {
  if (!Array.isArray(coords)) return [];
  return coords
    .filter(Array.isArray)
    .map((anillo) =>
      (anillo as unknown[])
        .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2 && typeof p[0] === "number" && typeof p[1] === "number")
        .map((p) => [p[0], p[1]] as Coord),
    )
    .filter((anillo) => anillo.length >= 3);
}

function polysDe(geometry: unknown): Coord[][][] {
  if (!geometry || typeof geometry !== "object") return [];
  const g = geometry as { type?: string; coordinates?: unknown };
  if (g.type === "Polygon") {
    const anillos = anillosDe(g.coordinates);
    return anillos.length ? [anillos] : [];
  }
  if (g.type === "MultiPolygon" && Array.isArray(g.coordinates)) {
    return g.coordinates.map((poly) => anillosDe(poly)).filter((poly) => poly.length > 0);
  }
  return [];
}

const CLAVES_NOMBRE = ["NOMBDEP", "DEPARTAMEN", "DEPARTAMENTO", "NOMBRE", "NAME", "name", "region", "REGION"];

function nombreDe(props: Record<string, unknown> | null | undefined): string | null {
  if (!props) return null;
  for (const clave of CLAVES_NOMBRE) {
    const valor = props[clave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
  }
  return null;
}

function bboxDe(formas: FormaRegion[]): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const f of formas) {
    for (const poly of f.polys) {
      for (const anillo of poly) {
        for (const [lon, lat] of anillo) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
  }
  if (!Number.isFinite(minLon)) return [-81.6, -18.6, -68.4, 0.5];
  return [minLon, minLat, maxLon, maxLat];
}

/** Interpreta un GeoJSON de regiones. Lanza si el texto no es JSON válido. */
export function parseGeoRegiones(texto: string): GeoRegiones {
  const data: unknown = JSON.parse(texto);
  const formas: FormaRegion[] = [];
  let sinNombre = 0;
  const noCoinciden: string[] = [];

  for (const ft of featuresDe(data)) {
    const polys = polysDe(ft.geometry);
    if (polys.length === 0) continue;
    const crudo = nombreDe(ft.properties);
    if (!crudo) {
      sinNombre += 1;
      continue;
    }
    const canon = emparejarRegion(crudo);
    if (!canon) {
      noCoinciden.push(crudo);
      continue;
    }
    formas.push({ slug: slugify(canon), nombre: canon, polys });
  }

  return { formas, sinNombre, noCoinciden, bbox: bboxDe(formas) };
}

/* ════ Proyección ════ */

export interface Proyector {
  (lon: number, lat: number): [number, number];
  width: number;
  height: number;
}

/**
 * Proyección equirectangular corregida por latitud media. El ancho del lienzo
 * es fijo y la altura se deriva de la relación de aspecto de la caja.
 */
export function crearProyector(bbox: [number, number, number, number], width = 1000, pad = 0.05): Proyector {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const latMedia = (minLat + maxLat) / 2;
  const kx = Math.max(0.05, Math.cos((latMedia * Math.PI) / 180));
  const spanX = (maxLon - minLon) * kx || 1;
  const spanY = maxLat - minLat || 1;
  const height = Math.max(200, Math.round(width * (spanY / spanX)));
  const padX = width * pad;
  const padY = height * pad;
  const w = width - 2 * padX;
  const h = height - 2 * padY;

  const proy = ((lon: number, lat: number): [number, number] => [
    padX + ((lon - minLon) * kx * w) / spanX,
    padY + ((maxLat - lat) * h) / spanY,
  ]) as Proyector;
  proy.width = width;
  proy.height = height;
  return proy;
}

/* ════ Distancias y agrupación ════ */

/** Distancia en km entre dos puntos (semiverseno). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371.0088;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/** Agrupa puntos a menos de `umbralPx` de distancia en el lienzo. */
export function agruparPuntos<T extends { x: number; y: number }>(puntos: T[], umbralPx = 20): { x: number; y: number; puntos: T[] }[] {
  const clusters: { x: number; y: number; puntos: T[] }[] = [];
  for (const p of puntos) {
    const c = clusters.find((k) => Math.hypot(k.x - p.x, k.y - p.y) <= umbralPx);
    if (c) {
      c.puntos.push(p);
      const n = c.puntos.length;
      c.x += (p.x - c.x) / n;
      c.y += (p.y - c.y) / n;
    } else {
      clusters.push({ x: p.x, y: p.y, puntos: [p] });
    }
  }
  return clusters;
}

/** Radio (unidades del lienzo) de un punto según su magnitud. */
export function radioMagnitud(magnitude: number): number {
  return 3 + Math.max(0, magnitude - 2) * 3.2;
}

/** Color de la escala neutra de cian para una proporción `[0, 1]`. */
export function escalaCian(t: number): string {
  const desde = [224, 247, 250];
  const hasta = [0, 96, 100];
  const c = desde.map((v, i) => Math.round(v + (hasta[i] - v) * Math.min(1, Math.max(0, t))));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Color de relleno de una región con 0 eventos (neutro, sin semáforo). */
export const SIN_EVENTOS = "#eef2f6";

/** Color único de los puntos de evento (misma gama de cian). */
export const COLOR_PUNTO = "#006064";
