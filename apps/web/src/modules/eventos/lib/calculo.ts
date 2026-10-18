/* ════════════════════════════════════════════════════════════════
   Cálculo puro del módulo de Eventos (orden y resumen).

   No depende de datos de ejemplo: opera sobre las filas que le entrega la API.
   Se mantiene aquí para que la tabla, la exportación y los modales compartan
   exactamente el mismo orden y los mismos totales.
   ════════════════════════════════════════════════════════════════ */

import type {
  CampoOrdenEventos,
  EventoSismico,
  OrdenEventos,
  RangoProfundidad,
  ResumenEventos,
} from "@/types";

const COMPARADORES: Record<CampoOrdenEventos, (a: EventoSismico, b: EventoSismico) => number> = {
  fecha: (a, b) => a.occurredAtUtc.localeCompare(b.occurredAtUtc),
  localidad: (a, b) => a.locality.localeCompare(b.locality, "es"),
  region: (a, b) => a.region.localeCompare(b.region, "es"),
  magnitud: (a, b) => a.magnitude - b.magnitude,
  profundidad: (a, b) => (a.depthKm ?? Number.POSITIVE_INFINITY) - (b.depthKm ?? Number.POSITIVE_INFINITY),
  estado: (a, b) => a.reviewStatus.localeCompare(b.reviewStatus),
  id: (a, b) => a.id.localeCompare(b.id),
  latitud: (a, b) => a.latitude - b.latitude,
  longitud: (a, b) => a.longitude - b.longitude,
};

export function ordenarEventos(filas: EventoSismico[], orden: OrdenEventos): EventoSismico[] {
  const cmp = COMPARADORES[orden.campo] ?? COMPARADORES.fecha;
  const signo = orden.direccion === "asc" ? 1 : -1;
  return [...filas].sort((a, b) => cmp(a, b) * signo || a.id.localeCompare(b.id));
}

/** Resumen de un conjunto de eventos ya filtrado. */
export function resumirFilas(filas: EventoSismico[]): ResumenEventos {
  let magnitudMaxima: EventoSismico | null = null;
  let pendientes = 0;
  let sinTipo = 0;
  const profundidades: number[] = [];

  for (const e of filas) {
    if (!magnitudMaxima || e.magnitude > magnitudMaxima.magnitude) magnitudMaxima = e;
    if (e.reviewStatus === "pendiente_validacion") pendientes += 1;
    if (e.magnitudeType === null) sinTipo += 1;
    if (e.depthKm != null) profundidades.push(e.depthKm);
  }

  let profundidad: RangoProfundidad | null = null;
  if (profundidades.length > 0) {
    profundidades.sort((a, b) => a - b);
    const mid = Math.floor(profundidades.length / 2);
    const mediana =
      profundidades.length % 2 === 1
        ? profundidades[mid]
        : Math.round((profundidades[mid - 1] + profundidades[mid]) / 2);
    profundidad = { min: profundidades[0], mediana, max: profundidades[profundidades.length - 1] };
  }

  return { total: filas.length, magnitudMaxima, profundidad, pendientes, sinTipo };
}
