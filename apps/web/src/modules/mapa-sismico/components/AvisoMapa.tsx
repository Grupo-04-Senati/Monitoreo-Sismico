import { IconInfo } from "@/components/ui/Icons";

/** Aviso fijo del módulo de mapa (fijado por el alcance del MVP). */
export default function AvisoMapa() {
  return (
    <p
      role="note"
      className="mb-3 flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2 text-[11px] leading-relaxed text-content-secondary"
    >
      <IconInfo size={14} className="mt-0.5 shrink-0" />
      <span className="font-medium text-content">Ubicación de eventos reportados. No representa zonas de impacto ni peligro.</span>
    </p>
  );
}
