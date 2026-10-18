import { ROLE_LABELS } from "@/types/auth";
import ExpandModal from "@/components/ui/ExpandModal";
import { fmtDateUTC5, fmtDateTimeUTC5 } from "@/lib/format";
import type { UsuarioAdmin } from "../types";
import { COLOR_ESTADO, ETIQUETA_ESTADO, SIMBOLO_ESTADO } from "../schemas/usuarios.schema";

interface ModalListaUsuariosProps {
  titulo: string;
  descripcion?: string;
  usuarios: UsuarioAdmin[];
  onAbrir: (usuario: UsuarioAdmin) => void;
  onCerrar: () => void;
}

/** Modal con la lista de cuentas que representa un indicador o una barra del gráfico. */
export default function ModalListaUsuarios({ titulo, descripcion, usuarios, onAbrir, onCerrar }: ModalListaUsuariosProps) {
  const pie = (
    <span className="text-content-muted">{usuarios.length} cuenta(s)</span>
  );

  return (
    <ExpandModal title={titulo} onClose={onCerrar} footer={pie}>
      {descripcion && <p className="mb-3 text-xs text-content-secondary">{descripcion}</p>}

      {usuarios.length === 0 ? (
        <p className="py-10 text-center text-sm text-content-muted">No hay cuentas en este grupo.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-secondary">
                {["Nombre", "Correo", "Rol(es)", "Estado", "MFA", "Último acceso", "Alta"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-content-secondary">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr
                  key={u.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => onAbrir(u)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onAbrir(u);
                    }
                  }}
                  className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-surface-tertiary focus:bg-surface-tertiary focus:outline-none"
                >
                  <td className="px-3 py-2 font-medium text-content">{u.nombre}</td>
                  <td className="px-3 py-2 text-content-secondary">{u.correo}</td>
                  <td className="px-3 py-2 text-content-secondary">
                    {u.roles.length ? u.roles.map((r) => ROLE_LABELS[r]).join(", ") : <span className="text-content-muted">Sin rol</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${COLOR_ESTADO[u.estado]}`}>
                      <span aria-hidden="true">{SIMBOLO_ESTADO[u.estado]}</span>
                      {ETIQUETA_ESTADO[u.estado]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-content-secondary">{u.mfa ? "Sí" : "No"}</td>
                  <td className="px-3 py-2 text-content-secondary">
                    {u.ultimoAccesoUtc ? fmtDateTimeUTC5(u.ultimoAccesoUtc) : "Nunca"}
                  </td>
                  <td className="px-3 py-2 text-content-secondary">{fmtDateUTC5(u.creadoUtc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ExpandModal>
  );
}
