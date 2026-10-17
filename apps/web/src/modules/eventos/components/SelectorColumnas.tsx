import { COLUMNAS_OPCIONALES } from "../schemas/filtros.schema";

interface SelectorColumnasProps {
  columnas: string[];
  onAlternar: (clave: string) => void;
}

/** Selector de columnas opcionales (ID, latitud, longitud) para la tabla. */
export default function SelectorColumnas({ columnas, onAlternar }: SelectorColumnasProps) {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-end gap-2 text-[11px] text-content-muted">
      <span id="selector-columnas-label">Columnas opcionales:</span>
      <div role="group" aria-labelledby="selector-columnas-label" className="flex flex-wrap items-center gap-1.5">
        {COLUMNAS_OPCIONALES.map((col) => {
          const activa = columnas.includes(col.value);
          return (
            <button
              key={col.value}
              type="button"
              onClick={() => onAlternar(col.value)}
              aria-pressed={activa}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                activa
                  ? "border-accent-600 bg-accent-600 text-white"
                  : "border-border bg-surface text-content-secondary hover:bg-surface-tertiary"
              }`}
            >
              {col.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
