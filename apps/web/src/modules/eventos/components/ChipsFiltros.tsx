import type { ChipFiltro } from "../types";
import { IconClose } from "@/components/ui/Icons";

interface ChipsFiltrosProps {
  chips: ChipFiltro[];
  onQuitar: (clave: string) => void;
  onLimpiar: () => void;
}

/** Filtros activos como chips removibles + "Limpiar todo". */
export default function ChipsFiltros({ chips, onQuitar, onLimpiar }: ChipsFiltrosProps) {
  if (chips.length === 0) return null;

  return (
    <ul className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Filtros aplicados">
      {chips.map((chip) => (
        <li key={chip.clave}>
          <span className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface-tertiary py-0.5 pl-2.5 pr-1 text-[12px] text-content-secondary">
            {chip.etiqueta}
            <button
              type="button"
              onClick={() => onQuitar(chip.clave)}
              className="rounded-full p-0.5 text-content-muted transition-colors hover:bg-surface hover:text-content"
              aria-label={`Quitar filtro ${chip.etiqueta}`}
            >
              <IconClose size={12} />
            </button>
          </span>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={onLimpiar}
          className="rounded-xl px-2.5 py-0.5 text-[12px] text-accent-600 transition-colors hover:underline"
        >
          Limpiar todo
        </button>
      </li>
    </ul>
  );
}
