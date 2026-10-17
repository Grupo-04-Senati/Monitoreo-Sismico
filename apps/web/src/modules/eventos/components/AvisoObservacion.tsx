import { IconInfo } from "@/components/ui/Icons";

/** Aviso fijo del módulo: los eventos son observaciones, no alertas oficiales. */
export default function AvisoObservacion() {
  return (
    <div
      role="note"
      className="mb-3 flex items-start gap-2.5 rounded-[10px] border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2.5"
    >
      <IconInfo size={16} className="mt-0.5 shrink-0 text-accent-600" />
      <p className="text-xs leading-relaxed text-content-secondary">
        <b className="font-semibold text-content">Eventos observados.</b> Registros de sismos reportados por la fuente; no
        son alertas oficiales ni predicciones, y el proveedor puede revisarlos o corregirlos.
      </p>
    </div>
  );
}
