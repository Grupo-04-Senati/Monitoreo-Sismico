import type { EjecucionFuente, FiltrosEjecuciones, PaginaEjecuciones } from "../types";
import { COLOR_EJECUCION, ESTADOS_EJECUCION, ETIQUETA_EJECUCION, ORDENES, PERIODOS } from "../schemas/fuentes.schema";
import { fmtDateTimeUTC5, fmtTimeUTC5 } from "@/lib/format";
import DataTable from "@/components/ui/DataTable";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import Paginador from "./Paginador";
import SelectorFilas from "./SelectorFilas";
import GraficoLatencia, { type PuntoLatencia } from "./GraficoLatencia";
import { IconExpand } from "@/components/ui/Icons";

const selectCls =
  "rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none";

interface TablaEjecucionesProps {
  datos: PaginaEjecuciones | null;
  ventana: EjecucionFuente[];
  cargando: boolean;
  ejec: FiltrosEjecuciones;
  tamano: number;
  onFiltros: (patch: Partial<FiltrosEjecuciones>) => void;
  onAbrir: (id: string) => void;
  /** Clic en un punto del gráfico (abre el detalle de esa ejecución). */
  onPunto?: (id: string) => void;
  onPagina: (n: number) => void;
  onTamano: (n: number) => void;
  onExpandirGrafico?: () => void;
  onExpandirTabla?: () => void;
}

function duracion(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

/** Ejecuciones de la ingesta: gráfico de latencia, filtros, tabla y paginación. */
export default function TablaEjecuciones({
  datos,
  ventana,
  cargando,
  ejec,
  tamano,
  onFiltros,
  onAbrir,
  onPunto,
  onPagina,
  onTamano,
  onExpandirGrafico,
  onExpandirTabla,
}: TablaEjecucionesProps) {
  const cronologico = ventana.slice().sort((a, b) => a.inicioUtc.localeCompare(b.inicioUtc));

  const puntos: PuntoLatencia[] = cronologico.map((e) => ({
    label: fmtTimeUTC5(e.inicioUtc),
    value: e.latenciaMs,
    estado: e.estado,
    tip: [`${fmtTimeUTC5(e.inicioUtc)} · ${ETIQUETA_EJECUCION[e.estado]}`, `${e.latenciaMs} ms`, `${e.insertados} insertados`],
  }));

  const columnas = [
    { key: "id", label: "Ejecución" },
    { key: "inicio", label: "Inicio (UTC-5)" },
    { key: "duracion", label: "Duración" },
    { key: "estado", label: "Estado" },
    { key: "leidos", label: "Leídos" },
    { key: "insertados", label: "Insertados" },
    { key: "duplicados", label: "Duplicados omitidos" },
    { key: "error", label: "Error (resumen)" },
  ];

  const filas = (datos?.filas ?? []).map((e) => ({
    id: <code className="font-mono text-[11px] text-content-secondary">{e.id}</code>,
    inicio: <span className="whitespace-nowrap">{fmtDateTimeUTC5(e.inicioUtc)}</span>,
    duracion: <span className="whitespace-nowrap text-content-secondary">{e.estado === "en_curso" ? `${duracion(e.duracionMs)}…` : duracion(e.duracionMs)}</span>,
    estado: <StatusBadge status={e.estado} label={ETIQUETA_EJECUCION[e.estado]} colorClass={COLOR_EJECUCION[e.estado]} />,
    leidos: e.leidos,
    insertados: <b className="font-semibold">{e.insertados}</b>,
    duplicados: e.duplicadosOmitidos,
    error: e.errorResumen ? (
      <span className="line-clamp-1 text-content-secondary" title={e.errorResumen}>
        {e.errorResumen}
      </span>
    ) : (
      <span className="text-content-muted">—</span>
    ),
  }));

  const botonExpandir = (onClick?: () => void) =>
    onClick ? (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-content-secondary transition-colors hover:bg-surface-tertiary"
      >
        <IconExpand size={13} />
        Pantalla completa
      </button>
    ) : undefined;

  return (
    <div>
      <Card
        title="Latencia por ejecución"
        help="Cada punto es una corrida de la ingesta. Las fallidas se fijan arriba (timeout) y se marcan en rojo."
        action={botonExpandir(onExpandirGrafico)}
        className="mb-3"
      >
        <GraficoLatencia data={puntos} onPuntoClick={onPunto ? (i) => onPunto(cronologico[i].id) : undefined} />
      </Card>

      {/* Filtros */}
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3.5">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-content-secondary">Periodo</span>
          <select value={ejec.periodo} onChange={(ev) => onFiltros({ periodo: ev.target.value })} className={selectCls} aria-label="Periodo">
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-content-secondary">Estado</span>
          <select value={ejec.estado} onChange={(ev) => onFiltros({ estado: ev.target.value as FiltrosEjecuciones["estado"] })} className={selectCls} aria-label="Estado">
            {ESTADOS_EJECUCION.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-content-secondary">Orden</span>
          <select value={ejec.orden} onChange={(ev) => onFiltros({ orden: ev.target.value as FiltrosEjecuciones["orden"] })} className={selectCls} aria-label="Orden">
            {ORDENES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <SelectorFilas tamano={tamano} onTamano={onTamano} />
        <span className="ml-auto text-[11px] text-content-muted">
          {ventana.length} ejecuciones en la ventana
        </span>
      </div>

      {/* Tabla */}
      <Card
        title="Ejecuciones de la ingesta"
        action={botonExpandir(onExpandirTabla)}
        className={cargando ? "opacity-60" : ""}
      >
        {datos && (
          <Paginador
            total={datos.total}
            pagina={datos.pagina}
            tamano={datos.tamano}
            totalPaginas={datos.totalPaginas}
            unidad="ejecuciones"
            onPagina={onPagina}
          />
        )}
        <DataTable
          columns={columnas}
          data={filas}
          onRowClick={(_row, i) => onAbrir((datos?.filas ?? [])[i].id)}
          emptyMessage="Sin ejecuciones para los filtros seleccionados."
        />
      </Card>

      <p className="mt-2 text-[11px] text-content-muted">
        Pulsa una fila o un punto del gráfico para ver el detalle, el estado HTTP, los intentos y el correlacionador.
      </p>
    </div>
  );
}
