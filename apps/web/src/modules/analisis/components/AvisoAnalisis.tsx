import { IconInfo } from "@/components/ui/Icons";

/** Aviso fijo: naturaleza descriptiva del análisis y affordance de interacción. */
export default function AvisoAnalisis() {
  return (
    <div
      role="note"
      className="mb-3 flex gap-2.5 rounded-lg border border-border border-l-4 border-l-accent-500 bg-surface-tertiary px-3 py-2.5 text-[12px] text-content-muted"
    >
      <span className="mt-0.5 shrink-0 text-accent-600" aria-hidden="true">
        <IconInfo size={15} />
      </span>
      <p>
        <b className="text-content">Análisis descriptivo.</b> Resume eventos ya observados. Una correlación no implica
        causalidad ni capacidad de predecir sismos. Cada gráfica muestra su n, los datos faltantes y los filtros
        aplicados. Haz clic en cualquier barra, punto o indicador para abrir su detalle, y usa “Ampliar” para la vista
        completa.
      </p>
    </div>
  );
}
