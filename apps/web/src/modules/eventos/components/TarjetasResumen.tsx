import type { ResumenEventos } from "../types";

/** Tarjeta individual de resumen (mismo tratamiento visual que los KPI del Dashboard). */
function Tarjeta({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle: string }) {
  return (
    <div className="auth-surface tilt rounded-[10px] border border-border bg-surface px-3.5 py-3">
      <small className="block text-[10px] uppercase tracking-[0.04em] text-content-muted">{etiqueta}</small>
      <b className="block text-[24px] font-bold leading-tight text-content">{valor}</b>
      <span className="block text-[11px] text-content-muted">{detalle}</span>
    </div>
  );
}

const pct = (parte: number, total: number) => (total > 0 ? `${((parte / total) * 100).toFixed(1)}%` : "—");

/** Cinco tarjetas que se recalculan con los filtros activos. */
export default function TarjetasResumen({ resumen }: { resumen: ResumenEventos | null }) {
  const total = resumen?.total ?? 0;
  const max = resumen?.magnitudMaxima ?? null;
  const prof = resumen?.profundidad ?? null;

  return (
    <div className="mb-3 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
      <Tarjeta etiqueta="Eventos" valor={String(total)} detalle="En la selección actual" />

      <Tarjeta
        etiqueta="Magnitud máxima"
        valor={max ? `${max.magnitude.toFixed(1)} ${max.magnitudeType ?? ""}`.trim() : "—"}
        detalle={max ? `${max.locality} · ${max.region}` : "Sin eventos en la selección"}
      />

      <Tarjeta
        etiqueta="Profundidad mediana"
        valor={prof ? `${prof.mediana} km` : "—"}
        detalle={prof ? `Rango ${prof.min}–${prof.max} km` : "Sin eventos en la selección"}
      />

      <Tarjeta
        etiqueta="Pendientes de validación"
        valor={String(resumen?.pendientes ?? 0)}
        detalle="Requieren revisión del proveedor"
      />

      <Tarjeta
        etiqueta="Sin tipo de magnitud"
        valor={String(resumen?.sinTipo ?? 0)}
        detalle={`${pct(resumen?.sinTipo ?? 0, total)} de la selección`}
      />
    </div>
  );
}
