import type { FiltrosEventos as Filtros, OpcionFiltro } from "../types";
import {
  ESTADOS,
  LIMITES_MAGNITUD,
  PERIODOS,
  REGIONES,
  type ErroresFiltros,
} from "../schemas/filtros.schema";
import { DATA_MAX_DAY, DATA_MIN_DAY } from "@/lib/mock/data";
import Combobox from "@/components/ui/Combobox";
import { IconFilter } from "@/components/ui/Icons";

interface FiltrosEventosProps {
  filtros: Filtros;
  errores: ErroresFiltros;
  hayFiltros: boolean;
  onCambiar: (patch: Partial<Filtros>) => void;
  onLimpiar: () => void;
}

const inputCls =
  "rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none";
const labelCls = "text-[11px] font-medium text-content-muted";

function segCls(on: boolean): string {
  return `border-r border-border px-2.5 py-1.5 text-xs font-medium transition-colors last:border-r-0 ${
    on ? "bg-accent-600 text-white" : "bg-surface text-content-secondary hover:bg-surface-tertiary"
  }`;
}

function aNumero(valor: string): number | null {
  if (valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

const REGION_OPTIONS: OpcionFiltro[] = REGIONES;

/** Barra de filtros del módulo. Todo cambio se refleja en la URL. */
export default function FiltrosEventos({ filtros, errores, hayFiltros, onCambiar, onLimpiar }: FiltrosEventosProps) {
  return (
    <div
      role="group"
      aria-label="Filtros de eventos"
      className="auth-surface mb-3 flex flex-wrap items-end gap-x-4 gap-y-3 rounded-[10px] border border-border bg-surface px-3.5 py-3"
    >
      <b className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-content">
        <IconFilter size={14} />
        Filtros
      </b>

      {/* Periodo */}
      <div className="flex flex-col gap-1">
        <span className={labelCls}>Periodo</span>
        <div className="flex items-center overflow-hidden rounded-md border border-border">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onCambiar({ periodo: p.value, ...(p.value === "custom" ? {} : { desde: "", hasta: "" }) })}
              aria-pressed={filtros.periodo === p.value}
              className={segCls(filtros.periodo === p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rango personalizado */}
      {filtros.periodo === "custom" && (
        <div className="flex flex-col gap-1">
          <span className={labelCls}>Desde / hasta (UTC-5)</span>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filtros.desde}
              min={DATA_MIN_DAY}
              max={DATA_MAX_DAY}
              onChange={(e) => onCambiar({ desde: e.target.value })}
              aria-label="Fecha inicial"
              aria-invalid={Boolean(errores.desde)}
              className={inputCls}
            />
            <input
              type="date"
              value={filtros.hasta}
              min={DATA_MIN_DAY}
              max={DATA_MAX_DAY}
              onChange={(e) => onCambiar({ hasta: e.target.value })}
              aria-label="Fecha final"
              aria-invalid={Boolean(errores.hasta)}
              aria-describedby={errores.hasta ? "error-fechas" : undefined}
              className={inputCls}
            />
          </div>
          {errores.hasta && (
            <p id="error-fechas" className="text-[11px] text-danger">
              {errores.hasta}
            </p>
          )}
        </div>
      )}

      {/* Región */}
      <div className="flex flex-col gap-1">
        <span className={labelCls}>Región</span>
        <Combobox
          ariaLabel="Buscar región"
          placeholder="Todas las regiones"
          value={filtros.region}
          options={REGION_OPTIONS}
          onChange={(region) => onCambiar({ region })}
          emptyText="Sin regiones con ese nombre"
          className="w-52"
        />
      </div>

      {/* Magnitud mínima / máxima */}
      <div className="flex flex-col gap-1">
        <span className={labelCls}>Magnitud (mín. / máx.)</span>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={LIMITES_MAGNITUD.min}
            max={LIMITES_MAGNITUD.max}
            value={filtros.magnitudMin ?? ""}
            placeholder="2.0"
            onChange={(e) => onCambiar({ magnitudMin: aNumero(e.target.value) })}
            aria-label="Magnitud mínima"
            aria-invalid={Boolean(errores.magnitud)}
            className={`${inputCls} w-20`}
          />
          <span className="text-content-muted" aria-hidden="true">
            –
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={LIMITES_MAGNITUD.min}
            max={LIMITES_MAGNITUD.max}
            value={filtros.magnitudMax ?? ""}
            placeholder="7.0"
            onChange={(e) => onCambiar({ magnitudMax: aNumero(e.target.value) })}
            aria-label="Magnitud máxima"
            aria-invalid={Boolean(errores.magnitud)}
            aria-describedby={errores.magnitud ? "error-magnitud" : undefined}
            className={`${inputCls} w-20`}
          />
        </div>
        {errores.magnitud && (
          <p id="error-magnitud" className="text-[11px] text-danger">
            {errores.magnitud}
          </p>
        )}
      </div>

      {/* Estado */}
      <div className="flex flex-col gap-1">
        <span className={labelCls}>Estado</span>
        <select
          value={filtros.estado}
          onChange={(e) => onCambiar({ estado: e.target.value as Filtros["estado"] })}
          aria-label="Estado del evento"
          className={inputCls}
        >
          {ESTADOS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={onLimpiar}
        disabled={!hayFiltros}
        className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs text-content-secondary transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-40"
      >
        Limpiar filtros
      </button>
    </div>
  );
}
