import type { ResumenReportes } from "../types";
import type { IdKpiReporte } from "../kpis";
import { KPIS } from "../kpis";

interface IndicadoresReportesProps {
  resumen: ResumenReportes;
  onAbrir: (id: IdKpiReporte) => void;
}

/** Indicadores clicables: cada uno abre el modal con la lista que representa. */
export default function IndicadoresReportes({ resumen, onAbrir }: IndicadoresReportesProps) {
  return (
    <div className="mb-3 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
      {KPIS.map((k) => (
        <button
          key={k.id}
          type="button"
          onClick={() => onAbrir(k.id)}
          title={`${k.descripcion} Ver la lista.`}
          className="auth-surface tilt group rounded-lg border border-border bg-surface p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent-500 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-content-muted">{k.etiqueta}</p>
          <p className="mt-1 text-2xl font-bold text-content">{k.valor(resumen)}</p>
          <p className="mt-1 text-[11px] font-medium text-accent-600 opacity-0 transition-opacity group-hover:opacity-100">
            Ver lista →
          </p>
        </button>
      ))}
    </div>
  );
}
