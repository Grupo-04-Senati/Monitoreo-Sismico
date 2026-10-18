import { ROLE_LABELS } from "@/types/auth";
import { fmtDateUTC5, fmtDateTimeUTC5 } from "@/lib/format";
import type { PaginaUsuarios, UsuarioAdmin } from "../types";
import { COLOR_ESTADO, ETIQUETA_ESTADO, SIMBOLO_ESTADO } from "../schemas/usuarios.schema";
import Paginador from "./Paginador";

interface TablaUsuariosProps {
  datos: PaginaUsuarios | null;
  cargando: boolean;
  onAbrir: (usuario: UsuarioAdmin) => void;
  onPagina: (n: number) => void;
}

/** Tabla principal del módulo. Clic en una fila abre el modal de usuario. */
export default function TablaUsuarios({ datos, cargando, onAbrir, onPagina }: TablaUsuariosProps) {
  if (cargando && !datos) {
    return <div className="py-10 text-center text-sm text-content-muted">Cargando usuarios…</div>;
  }
  if (!datos) return null;

  if (datos.filas.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface py-12 text-center">
        <p className="text-sm font-medium text-content">Sin resultados</p>
        <p className="mt-0.5 text-xs text-content-muted">Ajusta los filtros para ver otras cuentas.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">Lista de usuarios del sistema</caption>
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              {["Nombre", "Correo", "Rol(es)", "Estado", "MFA", "Último acceso", "Fecha de alta"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-content-secondary">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.filas.map((u) => (
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
                <td className="px-3 py-2.5 font-medium text-content">{u.nombre}</td>
                <td className="px-3 py-2.5 text-content-secondary">{u.correo}</td>
                <td className="px-3 py-2.5 text-content-secondary">
                  {u.roles.length ? u.roles.map((r) => ROLE_LABELS[r]).join(", ") : <span className="text-content-muted">Sin rol</span>}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${COLOR_ESTADO[u.estado]}`}>
                    <span aria-hidden="true">{SIMBOLO_ESTADO[u.estado]}</span>
                    {ETIQUETA_ESTADO[u.estado]}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-content-secondary">{u.mfa ? "Sí" : "No"}</td>
                <td className="px-3 py-2.5 text-content-secondary">
                  {u.ultimoAccesoUtc ? `${fmtDateTimeUTC5(u.ultimoAccesoUtc)}` : <span className="text-content-muted">Nunca</span>}
                </td>
                <td className="px-3 py-2.5 text-content-secondary">{fmtDateUTC5(u.creadoUtc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        <Paginador
          total={datos.total}
          pagina={datos.pagina}
          tamano={datos.tamano}
          totalPaginas={datos.totalPaginas}
          unidad="usuarios"
          onPagina={onPagina}
        />
      </div>
    </>
  );
}
