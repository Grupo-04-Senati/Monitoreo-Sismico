import { getEvents, resumirEventos as resumirEventosMock } from "@/lib/mock/events";
import { DATA_MAX_DAY, DATA_RANGE_LABEL, NOW, fmtDateTimeUTC5, mockSources } from "@/lib/mock/data";
import { downloadFile } from "@/lib/export";
import { SOURCE_NAME } from "@/config/fuente";
import type { EventoSismico, FiltrosEventos, OrdenEventos, PaginaEventos, ResumenEventos } from "../types";
import { ETIQUETA_ESTADO } from "../schemas/filtros.schema";

/* ════════════════════════════════════════════════════════════════
   Capa de acceso a datos del módulo de Eventos sísmicos.

   Hoy los datos son de ejemplo (mock determinista). Para conectar la API
   real basta con reemplazar el cuerpo de `listarEventos` por un `fetch`
   a `GET /api/v1/events` — ver `src/modules/eventos/README.md`.
   ════════════════════════════════════════════════════════════════ */

const LATENCIA_SIMULADA_MS = 220;

/**
 * Devuelve una página de eventos ya filtrada y ordenada.
 *
 * Contrato futuro con la API:
 *   GET /api/v1/events?periodo=&desde=&hasta=&region=&magnitudMin=&magnitudMax=&estado=&orden=&dir=&pagina=&tamano=
 *   → { filas, total, pagina, tamano, totalPaginas }
 */
export async function listarEventos(
  filtros: FiltrosEventos,
  orden: OrdenEventos,
  pagina: { numero: number; tamano: number },
): Promise<PaginaEventos> {
  await new Promise((resolve) => setTimeout(resolve, LATENCIA_SIMULADA_MS));
  return getEvents(filtros, orden, pagina);
}

/**
 * Totales de la selección filtrada (sin paginar), para las tarjetas de resumen.
 *
 * Contrato futuro: parte de la misma respuesta de `GET /api/v1/events`
 * (campo `resumen`) para no hacer dos consultas.
 */
export async function resumirEventos(filtros: FiltrosEventos): Promise<ResumenEventos> {
  await new Promise((resolve) => setTimeout(resolve, LATENCIA_SIMULADA_MS));
  return resumirEventosMock(filtros);
}

/* ════ Procedencia del catálogo ════ */

export interface Procedencia {
  fuente: string;
  ultimaSincronizacion: string;
  /** `null` mientras no se defina la licencia. */
  licencia: string | null;
  /** `null` mientras no se publiquen los términos de uso. */
  terminos: string | null;
  rangoCatalogo: string;
}

/**
 * Metadatos de la fuente para la franja de procedencia. Licencia y términos
 * están pendientes de definir (por eso se muestran como "pendiente").
 */
export function obtenerProcedencia(): Procedencia {
  return {
    fuente: SOURCE_NAME,
    ultimaSincronizacion: mockSources[0]?.lastSyncAt ?? NOW.toISOString(),
    licencia: null,
    terminos: null,
    rangoCatalogo: DATA_RANGE_LABEL,
  };
}

/* ════ Exportación CSV ════ */

const COLUMNAS_CSV = [
  "fecha_hora_utc5",
  "localidad",
  "region",
  "magnitud",
  "tipo_magnitud",
  "profundidad_km",
  "estado",
];

function celda(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Descarga en CSV todos los eventos que cumplen los filtros (no solo la
 * página visible), con el mismo orden que la tabla. Separador `;` y BOM
 * para que Excel abra bien los acentos.
 */
export function exportarEventosCsv(filtros: FiltrosEventos, orden: OrdenEventos): void {
  const filas: EventoSismico[] = getEvents(filtros, orden, { numero: 1, tamano: Number.MAX_SAFE_INTEGER }).filas;
  const lineas = [COLUMNAS_CSV.join(";")];
  for (const e of filas) {
    lineas.push(
      [
        fmtDateTimeUTC5(e.occurredAtUtc),
        e.locality,
        e.region,
        e.magnitude.toFixed(1),
        e.magnitudeType ?? "",
        e.depthKm,
        ETIQUETA_ESTADO[e.reviewStatus],
      ]
        .map(celda)
        .join(";"),
    );
  }
  const fecha = filtros.periodo === "custom" && filtros.hasta ? filtros.hasta : DATA_MAX_DAY;
  downloadFile(`eventos_sismicos_${fecha}.csv`, "\uFEFF" + lineas.join("\r\n"), "text/csv;charset=utf-8");
}
