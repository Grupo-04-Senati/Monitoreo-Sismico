import type { ChipAnalisis } from "../schemas/analisis.schema";
import { IconClose } from "@/components/ui/Icons";

interface ChipsAnalisisProps {
  chips: ChipAnalisis[];
  onQuitar: (clave: ChipAnalisis["clave"]) => void;
  onLimpiar: () => void;
}

/** Filtros activos como chips removibles + "Limpiar filtros". */
export default function ChipsAnalisis({ chips, onQuitar, onLimpiar }: ChipsAnalisisProps) {
  if (chips.length === 0) {
    return (
      <p className="mb-3 text-[11px] text-content-muted">Sin filtros activos (por defecto: últimos 30 días).</p>
    );
  }
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
        <button type="button" onClick={onLimpiar} className="rounded-xl px-2.5 py-0.5 text-[12px] text-accent-600 transition-colors hover:underline">
          Limpiar filtros
        </button>
      </li>
    </ul>
  );
}
