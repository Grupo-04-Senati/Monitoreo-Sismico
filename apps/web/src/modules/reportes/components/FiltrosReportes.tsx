import type { FiltrosReportes, OpcionFiltro } from "../types";
import { OPCIONES_ESTADO, OPCIONES_TIPO } from "../schemas/reportes.schema";
import SelectorFilas from "./SelectorFilas";

const selectCls =
  "rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none";

interface FiltrosReportesProps {
  filtros: FiltrosReportes;
  tamano: number;
  solicitantes: OpcionFiltro[];
  onFiltros: (patch: Partial<FiltrosReportes>) => void;
  onTamano: (n: number) => void;
  onLimpiar: () => void;
}

/** Barra de filtros del catálogo de informes (tipo, estado, solicitante). */
export default function FiltrosReportes({ filtros, tamano, solicitantes, onFiltros, onTamano, onLimpiar }: FiltrosReportesProps) {
  const activo = filtros.tipo || filtros.estado || filtros.solicitante;

  return (
    <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-content-secondary">Tipo</span>
        <select
          value={filtros.tipo}
          onChange={(e) => onFiltros({ tipo: e.target.value as FiltrosReportes["tipo"] })}
          className={selectCls}
        >
          {OPCIONES_TIPO.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-content-secondary">Estado</span>
        <select
          value={filtros.estado}
          onChange={(e) => onFiltros({ estado: e.target.value as FiltrosReportes["estado"] })}
          className={selectCls}
        >
          {OPCIONES_ESTADO.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-content-secondary">Solicitante</span>
        <select
          value={filtros.solicitante}
          onChange={(e) => onFiltros({ solicitante: e.target.value })}
          className={selectCls}
        >
          {solicitantes.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      <SelectorFilas tamano={tamano} onTamano={onTamano} />

      <button
        type="button"
        onClick={onLimpiar}
        disabled={!activo}
        className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-40"
      >
        Limpiar filtros
      </button>
    </div>
  );
}
