import { IconShield } from "@/components/ui/Icons";

/** Aviso fijo del módulo: el acceso se controla por función. */
export default function AvisoRoles() {
  return (
    <div
      role="note"
      className="mb-3 flex items-start gap-2.5 rounded-[10px] border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2.5"
    >
      <IconShield size={16} className="mt-0.5 shrink-0 text-accent-600" />
      <p className="text-xs leading-relaxed text-content-secondary">
        <b className="font-semibold text-content">El acceso se controla por función.</b> El rol lo asigna un Administrador;
        nadie elige su propio rol. Una cuenta pendiente no puede iniciar sesión y, aunque se llame la API directamente,
        las funciones bloqueadas responden <b className="font-semibold text-content">403</b>. Todo cambio de rol, alta o
        estado queda registrado en <b className="font-semibold text-content">Auditoría</b> con antes/después y sin secretos.
      </p>
    </div>
  );
}
