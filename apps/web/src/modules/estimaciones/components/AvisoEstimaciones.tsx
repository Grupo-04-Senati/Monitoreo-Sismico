import { IconInfo } from "@/components/ui/Icons";

/** Aviso fijo: una estimación experimental no es una predicción ni una alerta. */
export default function AvisoEstimaciones({ texto }: { texto?: string }) {
  return (
    <div
      role="note"
      className="mb-3 flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-purple-500 bg-surface px-3.5 py-2.5 text-[11px] leading-relaxed text-content-secondary"
    >
      <IconInfo size={14} className="mt-0.5 shrink-0 text-purple-600" />
      <span>
        <b className="font-semibold text-content">Estimaciones experimentales.</b>{" "}
        {texto ??
          "Generadas por un modelo estadístico aprobado. No predicen sismos individuales (cuándo, dónde ni de qué magnitud), no son alertas oficiales y no sustituyen la información del IGP ni de INDECI."}{" "}
        Cada una muestra su intervalo de incertidumbre, el modelo, la fecha de cálculo y la media histórica para
        compararla. Solo un Administrador puede publicarla.
      </span>
    </div>
  );
}
