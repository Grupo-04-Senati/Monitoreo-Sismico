import type { FiltrosLogs, PaginaLogs } from "../types";
import { COLOR_NIVEL, ETIQUETA_NIVEL, NIVELES_LOG, ORDENES } from "../schemas/fuentes.schema";
import { fmtDateTimeUTC5 } from "@/lib/format";
import Card from "@/components/ui/Card";
import DataTable from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import Paginador from "./Paginador";
import SelectorFilas from "./SelectorFilas";
import { IconExpand } from "@/components/ui/Icons";

const selectCls =
  "rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none";

interface TablaLogsProps {
  datos: PaginaLogs | null;
  cargando: boolean;
  logs: FiltrosLogs;
  tamano: number;
  onFiltros: (patch: Partial<FiltrosLogs>) => void;
  onPagina: (n: number) => void;
  onTamano: (n: number) => void;
  onExpandir?: () => void;
}

/** Registro de la ingesta (logs) con filtro por nivel. */
export default function TablaLogs({ datos, cargando, logs, tamano, onFiltros, onPagina, onTamano, onExpandir }: TablaLogsProps) {
  const columnas = [
    { key: "hora", label: "Hora (UTC-5)" },
    { key: "nivel", label: "Nivel" },
    { key: "mensaje", label: "Mensaje" },
    { key: "correlacion", label: "Correlación" },
  ];

  const filas = (datos?.filas ?? []).map((l) => ({
    hora: <span className="whitespace-nowrap">{fmtDateTimeUTC5(l.horaUtc)}</span>,
    nivel: <StatusBadge status={l.nivel} label={ETIQUETA_NIVEL[l.nivel]} colorClass={COLOR_NIVEL[l.nivel]} />,
    mensaje: <span className="text-content">{l.mensaje}</span>,
    correlacion: (
      <code className="font-mono text-[11px] text-content-muted" title={l.correlacion}>
        {l.correlacion}
      </code>
    ),
  }));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3.5">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-content-secondary">Nivel</span>
          <select
            value={logs.nivel}
            onChange={(ev) => onFiltros({ nivel: ev.target.value as FiltrosLogs["nivel"] })}
            className={selectCls}
            aria-label="Nivel del registro"
          >
            {NIVELES_LOG.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-content-secondary">Orden</span>
          <select
            value={logs.orden}
            onChange={(ev) => onFiltros({ orden: ev.target.value as FiltrosLogs["orden"] })}
            className={selectCls}
            aria-label="Orden del registro"
          >
            {ORDENES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <SelectorFilas tamano={tamano} onTamano={onTamano} />
      </div>

      <Card
        title="Registro de la ingesta"
        action={
          onExpandir ? (
            <button
              type="button"
              onClick={onExpandir}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-content-secondary transition-colors hover:bg-surface-tertiary"
            >
              <IconExpand size={13} />
              Pantalla completa
            </button>
          ) : undefined
        }
        className={cargando ? "opacity-60" : ""}
      >
        {datos && (
          <Paginador
            total={datos.total}
            pagina={datos.pagina}
            tamano={datos.tamano}
            totalPaginas={datos.totalPaginas}
            unidad="entradas"
            onPagina={onPagina}
          />
        )}
        <DataTable columns={columnas} data={filas} emptyMessage="Sin entradas para el nivel seleccionado." />
      </Card>
    </div>
  );
}
