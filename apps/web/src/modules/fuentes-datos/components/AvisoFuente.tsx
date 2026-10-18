import { IconInfo } from "@/components/ui/Icons";

/** Aviso fijo del módulo: cómo está conectada la fuente y qué falta por definir. */
export default function AvisoFuente() {
  return (
    <div
      role="note"
      className="mb-3 flex items-start gap-2.5 rounded-[10px] border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2.5"
    >
      <IconInfo size={16} className="mt-0.5 shrink-0 text-accent-600" />
      <p className="text-xs leading-relaxed text-content-secondary">
        <b className="font-semibold text-content">Fuente única en el MVP.</b> La URL, licencia,
        límites de uso y contacto de la fuente están pendientes de definir. Las credenciales solo se referencian (nunca en texto plano)
        y la ingesta es idempotente: reprocesar no duplica eventos.
      </p>
    </div>
  );
}
