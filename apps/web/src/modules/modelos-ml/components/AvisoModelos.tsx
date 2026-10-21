import { IconInfo } from "@/components/ui/Icons";

/** Aviso fijo del módulo: qué es (y qué no es) un experimento de ML. */
export default function AvisoModelos() {
  return (
    <div
      role="note"
      className="mb-3 flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2.5 text-[11px] leading-relaxed text-content-secondary"
    >
      <IconInfo size={14} className="mt-0.5 shrink-0 text-accent-600" />
      <span>
        Laboratorio <b className="font-semibold text-content">experimental</b>. Los modelos se entrenan con un dataset{" "}
        <b className="font-semibold text-content">aprobado</b> y se evalúan en su partición de prueba frente a{" "}
        <b className="font-semibold text-content">referencias simples</b>: si no las superan, se informa así. Ningún modelo
        predice cuándo, dónde ni de qué magnitud será un sismo, y sus resultados{" "}
        <b className="font-semibold text-content">no son alertas oficiales</b> ni sustituyen a IGP o INDECI.
      </span>
    </div>
  );
}
