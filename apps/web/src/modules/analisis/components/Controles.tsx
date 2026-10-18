interface SelectorFilasProps {
  tamano: number;
  onCambiar: (n: number) => void;
  id?: string;
  opciones?: number[];
}

const OPCIONES_FILAS = [5, 10, 25];

/** Selector de filas por página (va en la barra superior de la tabla). */
export function SelectorFilas({ tamano, onCambiar, id, opciones = OPCIONES_FILAS }: SelectorFilasProps) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-content-muted">
      Filas por página
      <select
        id={id}
        value={tamano}
        onChange={(e) => onCambiar(Number(e.target.value))}
        className="rounded-md border border-border bg-surface px-1.5 py-1 text-[11px] text-content focus:border-accent-500 focus:outline-none"
        aria-label="Filas por página"
      >
        {opciones.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

interface PaginadorProps {
  total: number;
  pagina: number;
  tamano: number;
  onPagina: (p: number) => void;
}

/** Rango + Anterior/Siguiente. Se coloca ENCIMA de la tabla. */
export function Paginador({ total, pagina, tamano, onPagina }: PaginadorProps) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamano));
  const p = Math.min(Math.max(pagina, 0), totalPaginas - 1);
  const desde = total ? p * tamano + 1 : 0;
  const hasta = Math.min(total, p * tamano + tamano);
  const btn =
    "px-2 py-1 text-[11px] border border-border rounded-md text-content-secondary hover:bg-surface-tertiary transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="mb-3 flex flex-wrap items-center justify-end gap-2 text-[11px] text-content-muted">
      <span>
        {total ? `${desde}–${hasta} de ${total.toLocaleString("es-PE")}` : "0 de 0"}
      </span>
      <button type="button" onClick={() => onPagina(p - 1)} disabled={p === 0} className={btn} aria-label="Página anterior">
        ◀
      </button>
      <button
        type="button"
        onClick={() => onPagina(p + 1)}
        disabled={p >= totalPaginas - 1}
        className={btn}
        aria-label="Página siguiente"
      >
        ▶
      </button>
    </div>
  );
}
