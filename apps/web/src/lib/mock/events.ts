import type {
  CampoOrdenEventos,
  EventoSismico,
  FiltrosEventos,
  OrdenEventos,
  PaginaEventos,
  RangoProfundidad,
  ResumenEventos,
  TipoMagnitud,
} from "@/types";
import { mockEvents, periodBounds, slugify } from "./data";
import { SOURCE_URL } from "@/config/fuente";

/* ════════════════════════════════════════════════════════════════
   Catálogo del módulo de Eventos sísmicos.

   Se deriva del catálogo compartido (`mockEvents`, 480 eventos en 30 días)
   para que el conteo coincida con el Dashboard, y se completan los campos
   operativos (coordenadas, tipo de magnitud, estado de revisión y hash de
   origen) de forma determinista con un PRNG de hash: el mismo evento
   devuelve siempre los mismos valores entre recargas.

   TODO(API): reemplazar `getEvents` por `GET /api/v1/events` — ver
   `src/modules/eventos/README.md`.
   ════════════════════════════════════════════════════════════════ */

/** Centroide aproximado de cada región (solo para mostrar coordenadas en texto). */
const REGION_COORDS: Record<string, [number, number]> = {
  Amazonas: [-6.23, -77.87],
  Áncash: [-9.53, -77.53],
  Apurímac: [-13.63, -72.88],
  Arequipa: [-16.4, -71.54],
  Ayacucho: [-13.16, -74.22],
  Cajamarca: [-7.16, -78.51],
  Callao: [-12.06, -77.13],
  Cusco: [-13.53, -71.97],
  Huancavelica: [-12.79, -74.97],
  Huánuco: [-9.93, -76.24],
  Ica: [-14.07, -75.73],
  Junín: [-12.07, -75.21],
  "La Libertad": [-8.11, -79.03],
  Lambayeque: [-6.77, -79.84],
  Lima: [-12.05, -77.04],
  Loreto: [-3.75, -73.25],
  "Madre de Dios": [-12.59, -69.19],
  Moquegua: [-17.19, -70.94],
  Pasco: [-10.69, -76.26],
  Piura: [-5.19, -80.63],
  Puno: [-15.84, -70.02],
  "San Martín": [-6.03, -76.97],
  Tacna: [-18.01, -70.25],
  Tumbes: [-3.57, -80.45],
  Ucayali: [-10.73, -73.75],
};

const DEFAULT_COORD: [number, number] = [-9.19, -75.02];

/** Hash FNV-1a de 32 bits: rápido, estable y sin dependencias. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Número pseudoaleatorio determinista en [0, 1) a partir de una clave. */
function rand01(key: string): number {
  return (hash32(key) % 100000) / 100000;
}

function hex8(n: number): string {
  return n.toString(16).padStart(8, "0");
}

function tipoMagnitud(id: string): TipoMagnitud | null {
  const r = hash32(id + ":tipo") % 100;
  if (r < 3) return null; // ~3% sin tipo determinado
  if (r < 70) return "Mw";
  if (r < 92) return "ML";
  return "mb";
}

function profundidadKm(id: string): number {
  // Sesgada a eventos superficiales, dentro de 3–200 km.
  const r = rand01(id + ":prof");
  return Math.round(3 + Math.pow(r, 2.2) * 197);
}

function coordenadas(id: string, region: string): [number, number] {
  const base = REGION_COORDS[region] ?? DEFAULT_COORD;
  const jLat = (rand01(id + ":la") - 0.5) * 0.9;
  const jLon = (rand01(id + ":lo") - 0.5) * 0.9;
  return [
    Math.round((base[0] + jLat) * 10000) / 10000,
    Math.round((base[1] + jLon) * 10000) / 10000,
  ];
}

function construirCatalogo(): EventoSismico[] {
  return mockEvents
    .map((e) => {
      const [latitude, longitude] = coordenadas(e.id, e.region);
      const pendiente = hash32(e.id + ":estado") % 100 < 5; // ~5% por validar
      return {
        id: e.id,
        externalId: e.externalId,
        occurredAtUtc: e.occurredAt,
        latitude,
        longitude,
        magnitude: e.magnitude,
        magnitudeType: tipoMagnitud(e.id),
        depthKm: profundidadKm(e.id),
        region: e.region,
        locality: e.place,
        reviewStatus: pendiente ? "pendiente_validacion" : "observado",
        sourceUrl: SOURCE_URL,
        receivedAtUtc: e.receivedAt,
        originHash: (hex8(hash32(e.id + ":oh1")) + hex8(hash32(e.id + ":oh2"))).slice(0, 16),
      } satisfies EventoSismico;
    })
    .sort((a, b) => b.occurredAtUtc.localeCompare(a.occurredAtUtc));
}

/** Catálogo determinista del módulo (480 eventos en 30 días). */
export const EVENTOS_SISMICOS: EventoSismico[] = construirCatalogo();

/* ════ Orden ════ */

const COMPARADORES: Record<CampoOrdenEventos, (a: EventoSismico, b: EventoSismico) => number> = {
  fecha: (a, b) => a.occurredAtUtc.localeCompare(b.occurredAtUtc),
  localidad: (a, b) => a.locality.localeCompare(b.locality, "es"),
  region: (a, b) => a.region.localeCompare(b.region, "es"),
  magnitud: (a, b) => a.magnitude - b.magnitude,
  profundidad: (a, b) => a.depthKm - b.depthKm,
  estado: (a, b) => a.reviewStatus.localeCompare(b.reviewStatus),
  id: (a, b) => a.id.localeCompare(b.id),
  latitud: (a, b) => a.latitude - b.latitude,
  longitud: (a, b) => a.longitude - b.longitude,
};

function ordenar(filas: EventoSismico[], orden: OrdenEventos): EventoSismico[] {
  const cmp = COMPARADORES[orden.campo] ?? COMPARADORES.fecha;
  const signo = orden.direccion === "asc" ? 1 : -1;
  return [...filas].sort((a, b) => cmp(a, b) * signo || a.id.localeCompare(b.id));
}

/* ════ Consulta principal ════ */

/** Aplica periodo, región, magnitud y estado. Base común de `getEvents` y `resumirEventos`. */
function filtrar(filtros: FiltrosEventos): EventoSismico[] {
  const { start, end } = periodBounds(filtros.periodo || "30d", filtros.desde, filtros.hasta);
  const min = filtros.magnitudMin;
  const max = filtros.magnitudMax;
  return EVENTOS_SISMICOS.filter((e) => {
    const t = new Date(e.occurredAtUtc).getTime();
    if (t < start || t > end) return false;
    if (filtros.region && slugify(e.region) !== filtros.region) return false;
    if (min != null && e.magnitude < min) return false;
    if (max != null && e.magnitude > max) return false;
    if (filtros.estado && e.reviewStatus !== filtros.estado) return false;
    return true;
  });
}

/**
 * Filtra, ordena y pagina el catálogo. Función pura y determinista.
 *
 * @param filtros  periodo/región/magnitud/estado (valores vacíos = sin restricción)
 * @param orden    columna y dirección
 * @param pagina   página solicitada (1-indexada) y tamaño de página
 */
export function getEvents(
  filtros: FiltrosEventos,
  orden: OrdenEventos,
  pagina: { numero: number; tamano: number },
): PaginaEventos {
  const ordenadas = ordenar(filtrar(filtros), orden);
  const total = ordenadas.length;
  const tamano = Math.max(1, Math.floor(pagina.tamano) || 10);
  const totalPaginas = Math.max(1, Math.ceil(total / tamano));
  const numero = Math.min(Math.max(1, Math.floor(pagina.numero) || 1), totalPaginas);
  const inicio = (numero - 1) * tamano;

  return {
    filas: ordenadas.slice(inicio, inicio + tamano),
    total,
    pagina: numero,
    tamano,
    totalPaginas,
  };
}

/** Totales de la selección filtrada (sin paginar) para las tarjetas de resumen. */
export function resumirEventos(filtros: FiltrosEventos): ResumenEventos {
  const filas = filtrar(filtros);

  let magnitudMaxima: EventoSismico | null = null;
  let pendientes = 0;
  let sinTipo = 0;
  const profundidades: number[] = [];

  for (const e of filas) {
    if (!magnitudMaxima || e.magnitude > magnitudMaxima.magnitude) magnitudMaxima = e;
    if (e.reviewStatus === "pendiente_validacion") pendientes += 1;
    if (e.magnitudeType === null) sinTipo += 1;
    profundidades.push(e.depthKm);
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
