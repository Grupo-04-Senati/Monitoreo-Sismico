import { ROLE_LABELS } from "@/types/auth";
import { ETIQUETA_ACCESO, MATRIZ_PERMISOS, ROLES_MATRIZ, SIMBOLO_ACCESO } from "../schemas/usuarios.schema";
import type { Role } from "@/types/auth";

interface MatrizPermisosProps {
  /** Rol a resaltar (por ejemplo, el rol del usuario abierto). */
  resaltar?: Role | null;
}

/** Tabla módulo × rol con el nivel de acceso (ver / operar / sin acceso). */
export default function MatrizPermisos({ resaltar = null }: MatrizPermisosProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">Matriz de permisos por módulo y rol</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-content-secondary">
              Módulo
            </th>
            {ROLES_MATRIZ.map((r) => (
              <th
                key={r}
                scope="col"
                className={`px-3 py-2 text-center font-semibold uppercase tracking-wide ${resaltar === r ? "text-accent-600" : "text-content-secondary"}`}
              >
                {ROLE_LABELS[r]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRIZ_PERMISOS.map((fila) => (
            <tr key={fila.modulo} className="border-b border-border last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-medium text-content">
                {fila.etiqueta}
              </th>
              {ROLES_MATRIZ.map((r) => {
                const acceso = fila.porRol[r];
                return (
                  <td
                    key={r}
                    className={`px-3 py-2 text-center ${resaltar === r ? "bg-accent-500/5" : ""} ${
                      acceso === "sin_acceso" ? "text-content-muted" : "text-content"
                    }`}
                    title={`${fila.etiqueta} · ${ROLE_LABELS[r]}: ${ETIQUETA_ACCESO[acceso]}`}
                  >
                    <span className="mr-1" aria-hidden="true">{SIMBOLO_ACCESO[acceso]}</span>
                    <span className="sr-only">{ETIQUETA_ACCESO[acceso]}</span>
                    <span className="hidden text-[10px] lg:inline">{ETIQUETA_ACCESO[acceso]}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-2 flex flex-wrap gap-4 text-[11px] text-content-muted">
        <span><b className="text-content">●</b> Puede operar (crear/editar)</span>
        <span><b className="text-content">◐</b> Puede ver</span>
        <span><b className="text-content">—</b> Sin acceso</span>
      </p>
    </div>
  );
}
