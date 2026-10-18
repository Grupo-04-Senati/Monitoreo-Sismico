import { TAMANOS_PAGINA } from "../schemas/reportes.schema";

const selectCls =
  "rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none";

interface SelectorFilasProps {
  tamano: number;
  onTamano: (n: number) => void;
}

/** Selector de filas por página; se coloca junto al resto de filtros. */
export default function SelectorFilas({ tamano, onTamano }: SelectorFilasProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-content-secondary">Filas por página</span>
      <select
        value={tamano}
        onChange={(ev) => onTamano(Number(ev.target.value))}
        aria-label="Filas por página"
        className={selectCls}
      >
        {TAMANOS_PAGINA.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
