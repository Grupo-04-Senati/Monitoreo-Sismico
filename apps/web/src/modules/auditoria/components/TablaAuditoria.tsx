import { fmtDateTimeUTC5 } from "@/lib/format";
import Paginador from "@/modules/reportes/components/Paginador";
import type { PaginaAuditoria, RegistroAuditoria } from "../types";
import { ACCIONES_SENSIBLES, etiquetaAccion, etiquetaEntidad } from "../schemas/auditoria.schema";

interface TablaAuditoriaProps {
  datos: PaginaAuditoria | null;
  cargando: boolean;
  filtrado: boolean;
  onAbrir: (r: RegistroAuditoria) => void;
  onPagina: (n: number) => void;
}

export function nombreActor(r: RegistroAuditoria): string {
  if (r.actor_name) return r.actor_name;
  return r.actor_id ? "Cuenta eliminada" : "Sistema";
}

/** Bitácora, más reciente primero. Clic en una fila abre el detalle. */
export default function TablaAuditoria({ datos, cargando, filtrado, onAbrir, onPagina }: TablaAuditoriaProps) {
  if (cargando && !datos) return <div className="py-10 text-center text-sm text-content-muted">Cargando registros…</div>;
  if (!datos) return null;
  if (datos.items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface py-12 text-center">
        <p className="text-sm font-medium text-content">{filtrado ? "Ningún registro con estos filtros" : "Aún no hay registros"}</p>
        <p className="mt-0.5 text-xs text-content-muted">
          {filtrado ? "Quita algún filtro o amplía el rango de fechas." : "Cada acción administrativa se registra aquí."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">Registros de auditoría</caption>
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              {["Fecha (UTC-5)", "Usuario", "Acción", "Entidad", "ID de la entidad", "Cambios"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-content-secondary">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.items.map((r) => {
              const campos = new Set([...Object.keys(r.before_json ?? {}), ...Object.keys(r.after_json ?? {})]).size;
              return (
                <tr
                  key={r.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => onAbrir(r)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      onAbrir(r);
                    }
                  }}
                  className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-surface-tertiary focus:bg-surface-tertiary focus:outline-none"
                >
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-content-secondary">{fmtDateTimeUTC5(r.occurred_at)}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-medium text-content">{nombreActor(r)}</span>
                    {r.actor_email && <span className="block text-[11px] text-content-muted">{r.actor_email}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    <span className={ACCIONES_SENSIBLES.has(r.action) ? "font-semibold text-content" : "text-content"}>
                      {ACCIONES_SENSIBLES.has(r.action) && <span aria-hidden="true">◆ </span>}
                      {etiquetaAccion(r.action)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-content-secondary">{etiquetaEntidad(r.entity_type)}</td>
                  <td className="max-w-[180px] truncate px-3 py-2.5 font-mono text-[11px] text-content-secondary" title={r.entity_id ?? undefined}>
                    {r.entity_id ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-content-secondary">{campos ? `${campos} campo${campos === 1 ? "" : "s"}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        <Paginador
          total={datos.total}
          pagina={datos.page}
          tamano={datos.page_size}
          totalPaginas={Math.max(1, Math.ceil(datos.total / datos.page_size))}
          unidad="registros"
          onPagina={onPagina}
        />
      </div>
    </>
  );
}
