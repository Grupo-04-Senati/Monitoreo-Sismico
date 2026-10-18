import type { FiltrosUsuarios } from "../types";
import { ESTADOS, ORDENES, ROLES_OPCIONES, ULTIMO_ACCESO } from "../schemas/usuarios.schema";
import SelectorFilas from "./SelectorFilas";

const selectCls =
  "w-44 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none";

interface FiltrosUsuariosProps {
  filtros: FiltrosUsuarios;
  tamano: number;
  onFiltros: (patch: Partial<FiltrosUsuarios>) => void;
  onTamano: (n: number) => void;
  onLimpiar: () => void;
}

/** Barra de filtros del módulo: estado, rol, último acceso, orden y búsqueda. */
export default function FiltrosUsuarios({ filtros, tamano, onFiltros, onTamano, onLimpiar }: FiltrosUsuariosProps) {
  return (
    <div className="mb-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] text-content-secondary">
          Búsqueda
          <span className="relative">
            <input
              type="search"
              value={filtros.q}
              onChange={(e) => onFiltros({ q: e.target.value })}
              placeholder="Nombre o correo…"
              aria-label="Buscar por nombre o correo"
              className="w-56 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-content placeholder:text-content-muted focus:border-accent-500 focus:outline-none"
            />
          </span>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-content-secondary">
          Estado
          <select value={filtros.estado} onChange={(e) => onFiltros({ estado: e.target.value as FiltrosUsuarios["estado"] })} className={selectCls} aria-label="Filtrar por estado">
            {ESTADOS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-content-secondary">
          Rol
          <select value={filtros.rol} onChange={(e) => onFiltros({ rol: e.target.value as FiltrosUsuarios["rol"] })} className={selectCls} aria-label="Filtrar por rol">
            {ROLES_OPCIONES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-content-secondary">
          Último acceso
          <select value={filtros.ultimoAcceso} onChange={(e) => onFiltros({ ultimoAcceso: e.target.value as FiltrosUsuarios["ultimoAcceso"] })} className={selectCls} aria-label="Filtrar por último acceso">
            {ULTIMO_ACCESO.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-content-secondary">
          Orden
          <select value={filtros.orden} onChange={(e) => onFiltros({ orden: e.target.value as FiltrosUsuarios["orden"] })} className={selectCls} aria-label="Orden de la lista">
            {ORDENES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <SelectorFilas tamano={tamano} onTamano={onTamano} />

        <button
          type="button"
          onClick={onLimpiar}
          className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs text-content-secondary transition-colors hover:bg-surface-tertiary"
        >
          Limpiar filtros
        </button>
      </div>
    </div>
  );
}
