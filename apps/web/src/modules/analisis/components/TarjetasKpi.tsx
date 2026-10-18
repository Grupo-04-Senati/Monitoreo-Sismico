import type { KpiInfo } from "../types";

interface TarjetasKpiProps {
  kpis: KpiInfo[];
  onAbrir: (indice: number) => void;
}

/** Indicadores del análisis. Cada tarjeta abre su detalle (qué significa y cómo se calcula). */
export default function TarjetasKpi({ kpis, onAbrir }: TarjetasKpiProps) {
  return (
    <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7" aria-label="Indicadores del análisis">
      {kpis.map((k, i) => (
        <button
          key={k.id}
          type="button"
          onClick={() => onAbrir(i)}
          className="auth-surface tilt flex flex-col rounded-[10px] border border-border bg-surface px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-accent-500 hover:shadow-md"
          aria-label={`Ver detalle de ${k.etiqueta}`}
        >
          <small className="block text-[10px] uppercase tracking-[0.04em] text-content-muted">{k.etiqueta}</small>
          <b className="block text-xl font-bold leading-tight text-content">{k.valor}</b>
          <span className="block truncate text-[11px] text-content-muted" title={k.pista}>
            {k.pista}
          </span>
        </button>
      ))}
    </div>
  );
}
