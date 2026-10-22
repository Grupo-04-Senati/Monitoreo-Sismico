import { IconInfo } from "@/components/ui/Icons";

/** Aviso fijo del módulo: cómo está conectada la fuente. */
export default function AvisoFuente() {
  return (
    <div
      role="note"
      className="mb-3 flex items-start gap-2.5 rounded-[10px] border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2.5"
    >
      <IconInfo size={16} className="mt-0.5 shrink-0 text-accent-600" />
      <p className="text-xs leading-relaxed text-content-secondary">
        <b className="font-semibold text-content">Fuente única.</b> La ficha muestra la URL, la licencia y los
        límites de uso del proveedor. Las credenciales solo se referencian (nunca en texto plano) y la ingesta es
        idempotente: reprocesar no duplica eventos; las correcciones de la fuente se aplican con historial.
      </p>
    </div>
  );
}
