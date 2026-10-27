import { apiGet } from "@/lib/api";
import type { Coord } from "../types";
import { polysDe } from "../lib/geo";

/* ════════════════════════════════════════════════════════════════
   Vista mundial del mapa (D30).

   Sismos M4.5+ del mundo en vivo (`GET /world/events`): contexto, no
   catálogo. No se guardan en la base ni generan avisos; el catálogo de
   trabajo sigue siendo la zona del Perú. Los contornos de países salen
   de `GET /regions/mundo` (Natural Earth, dominio público).
   ════════════════════════════════════════════════════════════════ */

export type PeriodoMundo = "dia" | "semana" | "mes";

export const PERIODOS_MUNDO: { valor: PeriodoMundo; etiqueta: string }[] = [
  { valor: "dia", etiqueta: "24 h" },
  { valor: "semana", etiqueta: "7 días" },
  { valor: "mes", etiqueta: "30 días" },
];

export interface SismoMundo {
  id: string;
  magnitud: number;
  tipo_magnitud: string | null;
  lugar: string | null;
  fecha: string | null;
  lat: number;
  lon: number;
  profundidad_km: number | null;
  estado: string | null;
  url: string | null;
  /** Cae en la zona que vigila el catálogo de trabajo (la misma de la ingesta). */
  zona_peru: boolean;
}

export interface RespuestaMundo {
  periodo: PeriodoMundo;
  fuente: string;
  generado_fuente: string | null;
  total: number;
  items: SismoMundo[];
  /** El USGS no respondió y se muestra la última copia guardada. */
  desactualizado: boolean;
}

export interface PaisMundo {
  nombre: string;
  iso: string;
  polys: Coord[][][];
}

/** Zona del catálogo de trabajo: el mismo recuadro que valida la ingesta. */
export const ZONA_PERU = { latMin: -18.6, latMax: 0.5, lonMin: -81.6, lonMax: -68.4 };

/** Caja del planisferio `[minLon, minLat, maxLon, maxLat]`: sin la Antártida. */
export const CAJA_MUNDO: [number, number, number, number] = [-180, -58, 180, 84];

export function cargarSismosMundo(periodo: PeriodoMundo): Promise<RespuestaMundo> {
  return apiGet<RespuestaMundo>(`/world/events?periodo=${periodo}`);
}

let _paises: Promise<PaisMundo[]> | null = null;

/** Contornos de países (se piden una vez por sesión). */
export function cargarPaises(): Promise<PaisMundo[]> {
  if (!_paises) {
    _paises = apiGet<{ features: { properties: { nombre: string; iso: string }; geometry: unknown }[] }>("/regions/mundo")
      .then((d) =>
        d.features
          .map((f) => ({ nombre: f.properties.nombre, iso: f.properties.iso, polys: polysDe(f.geometry) }))
          .filter((p) => p.polys.length > 0),
      )
      .catch((e) => {
        _paises = null;
        throw e;
      });
  }
  return _paises;
}

/** Radio (unidades del lienzo de 1000 de ancho) de un sismo del mundo según su magnitud. */
export function radioMundo(magnitud: number): number {
  return 2.8 + Math.max(0, magnitud - 4.5) * 2.8;
}
