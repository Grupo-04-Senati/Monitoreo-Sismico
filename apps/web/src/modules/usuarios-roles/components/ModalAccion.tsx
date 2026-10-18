import { useState } from "react";
import type { Role } from "@/types/auth";
import { ROLE_LABELS } from "@/types/auth";
import ExpandModal from "@/components/ui/ExpandModal";
import { IconAlertTriangle, IconInfo } from "@/components/ui/Icons";
import type { AccionUsuario, UsuarioAdmin } from "../types";
import { ROLES_MATRIZ } from "../schemas/usuarios.schema";

interface ModalAccionProps {
  usuario: UsuarioAdmin;
  accion: AccionUsuario;
  onConfirmar: (roles: Role[]) => void;
  onCerrar: () => void;
}

const TITULO: Record<AccionUsuario, string> = {
  aprobar: "Aprobar cuenta y asignar rol",
  "cambiar-rol": "Cambiar rol",
  suspender: "Suspender cuenta",
  reactivar: "Reactivar cuenta",
};

/** Confirmación previa a cada acción de Administrador (queda en Auditoría). */
export default function ModalAccion({ usuario, accion, onConfirmar, onCerrar }: ModalAccionProps) {
  const requiereRol = accion === "aprobar" || accion === "cambiar-rol";
  const [roles, setRoles] = useState<Role[]>(usuario.roles.length ? usuario.roles : ["viewer"]);

  const alternar = (r: Role) =>
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const puedeConfirmar = !requiereRol || roles.length > 0;

  const pie = (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onCerrar}
        className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-tertiary"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={() => onConfirmar(roles)}
        disabled={!puedeConfirmar}
        className="rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Confirmar
      </button>
    </div>
  );

  return (
    <ExpandModal title={TITULO[accion]} onClose={onCerrar} footer={pie}>
      <div className="max-w-xl space-y-3 text-sm text-content-secondary">
        <p>
          {accion === "suspender" ? (
            <>
              ¿Suspender la cuenta de <b className="text-content">{usuario.nombre}</b> ({usuario.correo})? No podrá iniciar
              sesión hasta que se reactive.
            </>
          ) : accion === "reactivar" ? (
            <>
              ¿Reactivar la cuenta de <b className="text-content">{usuario.nombre}</b>? Volverá a poder iniciar sesión con
              sus roles actuales.
            </>
          ) : accion === "aprobar" ? (
            <>
              Aprobar la cuenta de <b className="text-content">{usuario.nombre}</b> y asignarle un rol inicial.
            </>
          ) : (
            <>
              Cambiar el rol de <b className="text-content">{usuario.nombre}</b>.
            </>
          )}
        </p>

        {requiereRol && (
          <fieldset>
            <legend className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-content-muted">Roles</legend>
            <div className="flex flex-col gap-1.5">
              {ROLES_MATRIZ.map((r) => (
                <label key={r} className="flex items-center gap-2 text-xs text-content-secondary">
                  <input
                    type="checkbox"
                    checked={roles.includes(r)}
                    onChange={() => alternar(r)}
                    className="h-3.5 w-3.5 accent-[var(--accent-500)]"
                  />
                  {ROLE_LABELS[r]}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <p role="note" className="flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2 text-[11px] leading-relaxed text-content-secondary">
          <IconInfo size={13} className="mt-0.5 shrink-0" />
          <span>
            <b className="font-semibold text-content">Se registrará en Auditoría</b> con quién lo hizo y los valores
            antes/después (sin contraseñas ni tokens).
          </span>
        </p>

        {accion === "suspender" && (
          <p className="flex items-start gap-2 text-[11px] text-content-secondary">
            <IconAlertTriangle size={13} className="mt-0.5 shrink-0 text-accent-600" />
            Si es el último Administrador activo, el sistema no permitirá dejarlo sin acceso.
          </p>
        )}
      </div>
    </ExpandModal>
  );
}
