import type { CalidadCampo } from "@/types";

/* ════════════════════════════════════════════════════════════════
   Calidad de los datos — UNA única función, con la misma fórmula que
   el backend (`app/services/sources.py::calcular_calidad`).

   Fórmula documentada, por campo:
     % de nulos = eventos con el campo nulo ÷ eventos de la selección

   "La selección" es el conjunto de eventos recibidos del proveedor que se
   está evaluando (el catálogo completo de la fuente). Tanto el mock como la
   API aplican esta misma función a SUS propios eventos, por lo que los
   valores coinciden para la misma selección.
   ════════════════════════════════════════════════════════════════ */

/** Campos de un evento que se auditan; `null` cuenta como nulo. */
export interface EventoCalidad {
  externalId: string | null;
  occurredAtUtc: string | null;
  latitude: number | null;
  longitude: number | null;
  magnitude: number | null;
  magnitudeType: string | null;
  depthKm: number | null;
  region: string | null;
}

interface CampoDef {
  campo: string;
  get: (e: EventoCalidad) => unknown;
  observacion?: string;
}

const CAMPOS: CampoDef[] = [
  { campo: "identificador_externo", get: (e) => e.externalId },
  { campo: "fecha_hora_evento", get: (e) => e.occurredAtUtc },
  { campo: "latitud", get: (e) => e.latitude },
  { campo: "longitud", get: (e) => e.longitude },
  { campo: "magnitud", get: (e) => e.magnitude },
  {
    campo: "profundidad_km",
    get: (e) => e.depthKm,
    observacion: "Revisar valores de profundidad nulos o fuera de rango.",
  },
  { campo: "region", get: (e) => e.region },
  {
    campo: "tipo_magnitud",
    get: (e) => e.magnitudeType,
    observacion: "El proveedor no siempre informa el tipo de magnitud.",
  },
];

function formatear(campo: string, v: unknown): string | null {
  if (v == null) return null;
  switch (campo) {
    case "latitud":
    case "longitud":
      return Number(v).toFixed(4);
    case "magnitud":
      return Number(v).toFixed(1);
    case "profundidad_km":
      return Number(v).toFixed(0);
    default:
      return String(v);
  }
}

/**
 * Calcula el resumen de calidad por campo de una selección de eventos.
 * `ultimo` (el evento más reciente) aporta el valor de ejemplo por campo.
 */
export function calcularCalidad(eventos: EventoCalidad[]): CalidadCampo[] {
  const total = eventos.length;
  const ultimo =
    eventos.length > 0
      ? [...eventos].sort((a, b) => (b.occurredAtUtc ?? "").localeCompare(a.occurredAtUtc ?? ""))[0]
      : null;

  return CAMPOS.map(({ campo, get, observacion }) => {
    const nulos = eventos.reduce((s, e) => s + (get(e) == null ? 1 : 0), 0);
    const pctNulos = total ? Math.round((nulos / total) * 1000) / 10 : 0;
    const valor = (ultimo && formatear(campo, get(ultimo))) ?? "—";
    return { campo, nulos, total, pctNulos, valorEjemplo: valor, observacion: nulos > 0 ? (observacion ?? null) : null };
  });
}

/* ════ Indicador global (Dashboard) ════ */

export interface CalidadGlobal {
  /** 100 − % nulos − % duplicados. */
  pct: number;
  /** Nulos de todos los campos ÷ (eventos × nº de campos), en %. */
  pctNulos: number;
  /** Duplicados ÷ registros leídos de las ejecuciones, en %; `null` si no hay base. */
  pctDuplicados: number | null;
  /** Total de eventos de la selección. */
  totalEventos: number;
}

/**
 * Indicador "Calidad de datos" del Dashboard. Usa la MISMA selección que la
 * tabla de calidad (el catálogo de eventos de la fuente) y la misma fórmula:
 *   % nulos    = Σ nulos ÷ (eventos × campos)
 *   % duplicados = Σ duplicados omitidos ÷ Σ registros leídos
 *   calidad    = 100 − % nulos − % duplicados
 */
export function resumenCalidadGlobal(
  campos: CalidadCampo[],
  duplicadosOmitidos: number,
  registrosLeidos: number,
): CalidadGlobal {
  const totalEventos = campos[0]?.total ?? 0;
  const sumNulos = campos.reduce((s, c) => s + c.nulos, 0);
  const celdas = totalEventos * (campos.length || 1);
  const pctNulos = celdas ? Math.round((sumNulos / celdas) * 1000) / 10 : 0;
  const pctDuplicados = registrosLeidos > 0 ? Math.round((duplicadosOmitidos / registrosLeidos) * 1000) / 10 : null;
  const pct = Math.round((100 - pctNulos - (pctDuplicados ?? 0)) * 10) / 10;
  return { pct, pctNulos, pctDuplicados, totalEventos };
}
