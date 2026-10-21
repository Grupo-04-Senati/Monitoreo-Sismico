import { IconInfo } from "@/components/ui/Icons";

/**
 * Aviso fijo del módulo: qué es un dataset, por qué es reproducible y qué
 * significa aprobarlo.
 */
export default function AvisoPreparacion() {
  return (
    <div
      role="note"
      className="mb-3 flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2.5 text-[11px] leading-relaxed text-content-secondary"
    >
      <IconInfo size={14} className="mt-0.5 shrink-0 text-accent-600" />
      <span>
        Un dataset guarda la <b className="font-semibold text-content">lista exacta de eventos</b>, las reglas de limpieza
        y la partición temporal, así que un modelo entrenado con él es{" "}
        <b className="font-semibold text-content">reproducible</b> aunque el catálogo cambie. Repetir un nombre crea una{" "}
        <b className="font-semibold text-content">nueva versión</b>. Un dataset{" "}
        <b className="font-semibold text-content">aprobado</b> ya no se puede modificar (solo un Administrador aprueba).
        La partición es por fecha, nunca aleatoria, para no mezclar el futuro en el entrenamiento.
      </span>
    </div>
  );
}
