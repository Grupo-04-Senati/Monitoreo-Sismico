import ExpandModal from "@/components/ui/ExpandModal";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { RegistroAuditoria } from "../types";
import { diferencias, etiquetaAccion, etiquetaEntidad } from "../schemas/auditoria.schema";
import { nombreActor } from "./TablaAuditoria";

interface DetalleRegistroModalProps {
  registro: RegistroAuditoria;
  onFiltrarEntidad: (r: RegistroAuditoria) => void;
  onCerrar: () => void;
}

/** Detalle de un registro: quién, qué, cuándo y el antes/después (sin secretos). */
export default function DetalleRegistroModal({ registro: r, onFiltrarEntidad, onCerrar }: DetalleRegistroModalProps) {
  const filas = diferencias(r.before_json, r.after_json);
  const ficha: [string, string][] = [
    ["Fecha (UTC)", new Date(r.occurred_at).toISOString().replace("T", " ").slice(0, 19)],
    ["Fecha (UTC-5)", fmtDateTimeUTC5(r.occurred_at)],
    ["Usuario", r.actor_email ? `${nombreActor(r)} · ${r.actor_email}` : nombreActor(r)],
    ["ID del usuario", r.actor_id ?? "—"],
    ["Acción", `${etiquetaAccion(r.action)} (${r.action})`],
    ["Entidad", `${etiquetaEntidad(r.entity_type)} (${r.entity_type})`],
    ["ID de la entidad", r.entity_id ?? "—"],
    ["Correlación", r.correlation_id ?? "—"],
    ["ID del registro", r.id],
  ];

  const pie = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-content-muted">Registro protegido: no se puede editar ni borrar.</span>
      {r.entity_id && (
        <button
          type="button"
          onClick={() => onFiltrarEntidad(r)}
          className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs font-medium text-content transition-colors hover:bg-surface-tertiary"
        >
          Ver historial de esta entidad
        </button>
      )}
    </div>
  );

  return (
    <ExpandModal title={`${etiquetaAccion(r.action)} · ${fmtDateTimeUTC5(r.occurred_at)}`} onClose={onCerrar} footer={pie} resizable>
      <div className="space-y-4">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
          {ficha.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-content-secondary">{k}</dt>
              <dd className="break-all font-medium text-content">{v}</dd>
            </div>
          ))}
        </dl>

        <section>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-content-secondary">Antes y después</h4>
          {filas.length === 0 ? (
            <p className="text-xs text-content-muted">Esta acción no registra valores (p. ej. un inicio de sesión).</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <caption className="sr-only">Valores antes y después de la acción</caption>
                <thead className="bg-surface-secondary">
                  <tr>
                    {["Campo", "Antes", "Después"].map((h) => (
                      <th key={h} scope="col" className="px-2.5 py-1.5 text-left text-[11px] font-semibold text-content-secondary">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.campo} className={`border-t border-border ${f.cambio ? "bg-cyan-50/60 dark:bg-cyan-950/40" : ""}`}>
                      <td className="px-2.5 py-1.5 font-mono text-content">
                        {f.cambio && <span aria-label="cambió" className="mr-1 text-cyan-700 dark:text-cyan-300">●</span>}
                        {f.campo}
                      </td>
                      <td className="break-all px-2.5 py-1.5 font-mono text-content-secondary">{f.antes}</td>
                      <td className="break-all px-2.5 py-1.5 font-mono text-content">{f.despues}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[11px] text-content-muted">
            Contraseñas, tokens y secretos se filtran antes de guardar: nunca aparecen aquí.
          </p>
        </section>
      </div>
    </ExpandModal>
  );
}
