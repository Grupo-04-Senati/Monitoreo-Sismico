import type { ResumenEventos, SeccionResumen } from "../types";

/** Tarjeta individual de resumen (mismo tratamiento visual que los KPI del Dashboard). */
function Tarjeta({
  etiqueta,
  valor,
  detalle,
  onAbrir,
}: {
  etiqueta: string;
  valor: string;
  detalle: string;
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Ver el detalle de ${etiqueta}`}
      className="auth-surface tilt w-full rounded-[10px] border border-border bg-surface px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-accent-500 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
    >
      <small className="block text-[10px] uppercase tracking-[0.04em] text-content-muted">{etiqueta}</small>
      <b className="block text-[24px] font-bold leading-tight text-content">{valor}</b>
      <span className="block text-[11px] text-content-muted">{detalle}</span>
    </button>
  );
}

const pct = (parte: number, total: number) => (total > 0 ? `${((parte / total) * 100).toFixed(1)}%` : "—");

/** Cinco tarjetas que se recalculan con los filtros activos y abren su detalle. */
export default function TarjetasResumen({
  resumen,
  onAbrir,
}: {
  resumen: ResumenEventos | null;
  onAbrir: (seccion: SeccionResumen) => void;
}) {
  const total = resumen?.total ?? 0;
  const max = resumen?.magnitudMaxima ?? null;
  const prof = resumen?.profundidad ?? null;
  const pendientes = resumen?.pendientes ?? 0;
  const sinTipo = resumen?.sinTipo ?? 0;

  return (
    <div className="mb-3 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
      <Tarjeta
        etiqueta="Eventos"
        valor={String(total)}
        detalle="En la selección actual"
        onAbrir={() => onAbrir("eventos")}
      />

      <Tarjeta
        etiqueta="Magnitud máxima"
        valor={max ? `${max.magnitude.toFixed(1)} ${max.magnitudeType ?? ""}`.trim() : "—"}
        detalle={max ? `${max.locality} · ${max.region}` : "Sin eventos en la selección"}
        onAbrir={() => onAbrir("magnitud")}
      />

      <Tarjeta
        etiqueta="Profundidad mediana"
        valor={prof ? `${prof.mediana} km` : "—"}
        detalle={prof ? `Rango ${prof.min}–${prof.max} km` : "Sin eventos en la selección"}
        onAbrir={() => onAbrir("profundidad")}
      />

      <Tarjeta
        etiqueta="Pendientes de validación"
        valor={String(pendientes)}
        detalle={`${pct(pendientes, total)} de la selección`}
        onAbrir={() => onAbrir("pendientes")}
      />

      <Tarjeta
        etiqueta="Sin tipo de magnitud"
        valor={String(sinTipo)}
        detalle={`${pct(sinTipo, total)} de la selección`}
        onAbrir={() => onAbrir("sinTipo")}
      />
    </div>
  );
}
