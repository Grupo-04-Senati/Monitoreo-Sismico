import type { SeismicEvent } from "@/types";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { Columna, IdGrafico, ResultadoAnalisis, Tabla } from "../types";

/* ════════════════════════════════════════════════════════════════
   Tablas derivadas de cada gráfico (para la vista ampliada) y de una
   lista de eventos (para el modal de barras/puntos).
   ════════════════════════════════════════════════════════════════ */

export const COLUMNAS_EVENTOS: Columna[] = [
  { clave: "id", etiqueta: "ID" },
  { clave: "fecha", etiqueta: "Fecha (UTC-5)" },
  { clave: "localidad", etiqueta: "Localidad" },
  { clave: "region", etiqueta: "Región" },
  { clave: "magnitud", etiqueta: "Magnitud", numerica: true },
  { clave: "profundidad", etiqueta: "Profundidad", numerica: true },
];

/** Filas de eventos ordenadas del más reciente al más antiguo. */
export function filasEventos(eventos: SeismicEvent[]): (string | number)[][] {
  return [...eventos]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((e) => [
      e.id,
      fmtDateTimeUTC5(e.occurredAt),
      e.place,
      e.region,
      `${e.magnitude.toFixed(1)} ${e.magnitudeType}`,
      `${e.depthKm} km`,
    ]);
}

const conAcumulado = (puntos: { label: string; value: number }[]): (string | number)[][] => {
  const total = puntos.reduce((s, p) => s + p.value, 0) || 1;
  let c = 0;
  return puntos.map((p) => {
    c += p.value;
    return [p.label, p.value, `${((c / total) * 100).toFixed(1)}%`];
  });
};

/** Tabla que acompaña a cada gráfico en la vista ampliada. */
export function tablaDeGrafico(id: IdGrafico, r: ResultadoAnalisis): { columnas: Columna[]; filas: (string | number)[][]; total: number; faltantes: number } {
  switch (id) {
    case "ts":
      return {
        columnas: [
          { clave: "p", etiqueta: r.serie.unidad },
          { clave: "n", etiqueta: "Eventos", numerica: true },
        ],
        filas: r.serie.puntos.map((p) => [p.label, p.value]),
        total: r.serie.puntos.length,
        faltantes: 0,
      };
    case "mh":
      return {
        columnas: [
          { clave: "r", etiqueta: "Rango de magnitud" },
          { clave: "n", etiqueta: "Eventos", numerica: true },
          { clave: "pc", etiqueta: "% acum.", numerica: true },
        ],
        filas: conAcumulado(r.magnitudes.puntos),
        total: r.n,
        faltantes: r.faltantes,
      };
    case "dh":
      return {
        columnas: [
          { clave: "r", etiqueta: "Rango de profundidad" },
          { clave: "n", etiqueta: "Eventos", numerica: true },
          { clave: "pc", etiqueta: "% acum.", numerica: true },
        ],
        filas: conAcumulado(r.profundidades.puntos),
        total: r.n,
        faltantes: r.profundidades.faltantes,
      };
    case "rg":
      return {
        columnas: [
          { clave: "r", etiqueta: "Región" },
          { clave: "n", etiqueta: "Eventos", numerica: true },
        ],
        filas: r.regiones.puntos.map((p) => [p.label, p.value]),
        total: r.regiones.puntos.reduce((s, p) => s + p.value, 0),
        faltantes: 0,
      };
    case "sc":
      return {
        columnas: [
          { clave: "id", etiqueta: "Evento" },
          { clave: "x", etiqueta: r.dispersion.xLabel, numerica: true },
          { clave: "y", etiqueta: r.dispersion.yLabel, numerica: true },
        ],
        filas: r.dispersion.puntos.map((p) => [p.evento.id, p.x, p.y]),
        total: r.dispersion.puntos.length,
        faltantes: 0,
      };
    case "st":
      return r.resumen;
    case "ev":
      return r.eventos;
    default:
      return { columnas: [], filas: [], total: 0, faltantes: 0 };
  }
}

export type { Tabla };
