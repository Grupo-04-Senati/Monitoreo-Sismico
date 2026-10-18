import { IconChevronLeft, IconChevronRight } from "@/components/ui/Icons";

interface PaginadorProps {
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
  unidad: string;
  onPagina: (n: number) => void;
}

/** Pie de paginación del módulo. */
export default function Paginador({ total, pagina, tamano, totalPaginas, unidad, onPagina }: PaginadorProps) {
  const desde = total === 0 ? 0 : (pagina - 1) * tamano + 1;
  const hasta = Math.min(pagina * tamano, total);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-content-secondary">
      <span aria-live="polite">
        Mostrando <b className="font-semibold text-content">{desde}</b>–<b className="font-semibold text-content">{hasta}</b> de{" "}
        <b className="font-semibold text-content">{total.toLocaleString("es-PE")}</b> {unidad}
      </span>

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
  );
}
