import type { KeyboardEvent } from "react";
import type { CampoOrdenEventos, EventoSismico, EstadoRevision, OrdenEventos } from "../types";
import { ETIQUETA_ESTADO, TAMANOS_PAGINA } from "../schemas/filtros.schema";
import { fmtDateTimeUTC5 } from "@/lib/mock/data";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/Icons";

interface ColDef {
  campo: CampoOrdenEventos;
  etiqueta: string;
  numerica?: boolean;
}

const COL_ID: ColDef = { campo: "id", etiqueta: "ID" };
const COL_LAT: ColDef = { campo: "latitud", etiqueta: "Latitud", numerica: true };
const COL_LON: ColDef = { campo: "longitud", etiqueta: "Longitud", numerica: true };

/** Orden de las columnas: las opcionales se intercalan en su sitio natural. */
function columnasVisibles(opcionales: string[]): ColDef[] {
  return [
    ...(opcionales.includes("id") ? [COL_ID] : []),
    { campo: "fecha", etiqueta: "Fecha y hora (UTC-5)" },
    { campo: "localidad", etiqueta: "Localidad" },
    { campo: "region", etiqueta: "Región" },
    ...(opcionales.includes("latitud") ? [COL_LAT] : []),
    ...(opcionales.includes("longitud") ? [COL_LON] : []),
    { campo: "magnitud", etiqueta: "Magnitud", numerica: true },
    { campo: "profundidad", etiqueta: "Profundidad (km)", numerica: true },
    { campo: "estado", etiqueta: "Estado" },
  ];
}

interface TablaEventosProps {
  filas: EventoSismico[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
  orden: OrdenEventos;
  /** Claves de las columnas opcionales visibles (id, latitud, longitud). */
  columnas: string[];
  cargando: boolean;
  onOrdenar: (campo: CampoOrdenEventos) => void;
  onAbrir: (indice: number) => void;
  onPagina: (n: number) => void;
  onTamano: (n: number) => void;
}

function Estado({ estado }: { estado: EstadoRevision }) {
  if (estado === "pendiente_validacion") {
    return (
      <span className="inline-flex items-center rounded-full border border-accent-600 px-2 py-0.5 text-[11px] font-medium text-accent-600">
        {ETIQUETA_ESTADO.pendiente_validacion}
      </span>
    );
  }
  return <span className="text-content-secondary">{ETIQUETA_ESTADO.observado}</span>;
}

/** Contenido de una celda según la columna. */
function Celda({ campo, e }: { campo: CampoOrdenEventos; e: EventoSismico }) {
  switch (campo) {
    case "localidad":
      return <span className="line-clamp-1">{e.locality}</span>;
    case "region":
      return <>{e.region}</>;
    case "magnitud":
      return (
        <>
          <b className="font-semibold">{e.magnitude.toFixed(1)}</b>{" "}
          <span className="text-content-muted">{e.magnitudeType ?? "—"}</span>
        </>
      );
    case "profundidad":
      return <>{e.depthKm}</>;
    case "estado":
      return <Estado estado={e.reviewStatus} />;
    case "id":
      return (
        <code className="font-mono text-[11px] text-content-secondary" title={e.id}>
          {e.id}
        </code>
      );
    case "latitud":
      return <>{e.latitude.toFixed(4)}</>;
    case "longitud":
      return <>{e.longitude.toFixed(4)}</>;
    case "fecha":
    default:
      return <>{fmtDateTimeUTC5(e.occurredAtUtc)}</>;
  }
}

/** Cabecera de columna ordenable con `aria-sort`. */
function Th({ col, orden, onOrdenar }: { col: ColDef; orden: OrdenEventos; onOrdenar: (c: CampoOrdenEventos) => void }) {
  const activa = orden.campo === col.campo;
  const ariaSort = activa ? (orden.direccion === "asc" ? "ascending" : "descending") : "none";
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-content-secondary ${
        col.numerica ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => onOrdenar(col.campo)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-content ${
          col.numerica ? "flex-row-reverse" : ""
        } ${activa ? "text-content" : ""}`}
        title={`Ordenar por ${col.etiqueta}`}
      >
        {col.etiqueta}
        <span className="text-[9px] text-content-muted" aria-hidden="true">
          {activa ? (orden.direccion === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

export default function TablaEventos({
  filas,
  total,
  pagina,
  tamano,
  totalPaginas,
  orden,
  columnas,
  cargando,
  onOrdenar,
  onAbrir,
  onPagina,
  onTamano,
}: TablaEventosProps) {
  const cols = columnasVisibles(columnas);
  const desde = total === 0 ? 0 : (pagina - 1) * tamano + 1;
  const hasta = Math.min(pagina * tamano, total);

  const onFilaTecla = (ev: KeyboardEvent<HTMLTableRowElement>, indice: number) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onAbrir(indice);
    }
  };

  return (
    <div>
      <div
        className={`chart-plot max-h-[68vh] overflow-auto rounded-lg transition-opacity ${cargando ? "opacity-60" : ""}`}
        role="region"
        aria-label="Tabla de eventos sísmicos"
        aria-busy={cargando}
        tabIndex={0}
      >
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Eventos sísmicos del periodo y filtros seleccionados. Pulsa una fila o Enter para ver el detalle.
          </caption>
          <thead className="sticky top-0 z-10 bg-surface-tertiary">
            <tr className="border-b border-border">
              {cols.map((col) => (
                <Th key={col.campo} col={col} orden={orden} onOrdenar={onOrdenar} />
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((e, i) => (
              <tr
                key={e.id}
                tabIndex={0}
                onClick={() => onAbrir(i)}
                onKeyDown={(ev) => onFilaTecla(ev, i)}
                title="Ver detalle del evento"
                className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-tertiary focus:bg-surface-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
              >
                {cols.map((col) => (
                  <td
                    key={col.campo}
                    className={`px-3 py-2.5 ${col.numerica ? "text-right" : ""} ${
                      col.campo === "localidad" ? "text-content" : "whitespace-nowrap"
                    } ${col.campo === "region" ? "text-content-secondary" : col.numerica ? "text-content-secondary" : "text-content"}`}
                  >
                    <Celda campo={col.campo} e={e} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-content-secondary">
        <span aria-live="polite">
          Mostrando <b className="font-semibold text-content">{desde}</b>–<b className="font-semibold text-content">{hasta}</b> de{" "}
          <b className="font-semibold text-content">{total.toLocaleString("es-PE")}</b> eventos
        </span>

        <label className="flex items-center gap-1.5">
          <span>Filas:</span>
          <select
            value={tamano}
            onChange={(ev) => onTamano(Number(ev.target.value))}
            aria-label="Filas por página"
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-content focus:border-accent-500 focus:outline-none"
          >
            {TAMANOS_PAGINA.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPagina(pagina - 1)}
            disabled={pagina <= 1}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-content-secondary transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconChevronLeft size={13} />
            Anterior
          </button>
          <span>
            Página <b className="font-semibold text-content">{pagina}</b> de {totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => onPagina(pagina + 1)}
            disabled={pagina >= totalPaginas}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-content-secondary transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente
            <IconChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
