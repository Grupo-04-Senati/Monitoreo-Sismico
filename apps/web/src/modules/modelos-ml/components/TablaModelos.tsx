import Card from "@/components/ui/Card";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { ModeloAprobado } from "../types";
import { ETIQUETA_MODELO, ETIQUETA_TAREA, fmtNum } from "../schemas/ml.schema";

/** Registro de modelos aprobados: los únicos que podrán publicar estimaciones. */
export default function TablaModelos({ modelos, onAbrir }: { modelos: ModeloAprobado[] | null; onAbrir: (experimentId: string) => void }) {
  return (
    <Card title="Modelos aprobados" help="Solo un modelo aprobado por un Administrador podrá publicar estimaciones experimentales.">
      {modelos === null ? (
        <p className="py-4 text-center text-xs text-content-muted">Cargando…</p>
      ) : modelos.length === 0 ? (
        <p className="py-4 text-center text-xs text-content-muted">Todavía no hay modelos aprobados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <caption className="sr-only">Modelos aprobados</caption>
            <thead>
              <tr className="border-b border-border">
                {["Modelo", "Versión", "Tarea", "Algoritmo", "MAE (prueba)", "Aprobado"].map((h) => (
                  <th key={h} scope="col" className="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-content-secondary">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modelos.map((m) => (
                <tr
                  key={m.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => onAbrir(m.experiment_id)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      onAbrir(m.experiment_id);
                    }
                  }}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-tertiary focus:bg-surface-tertiary focus:outline-none"
                >
                  <td className="px-2.5 py-1.5 font-medium text-content">{m.name}</td>
                  <td className="px-2.5 py-1.5 text-content-secondary">v{m.version}</td>
                  <td className="px-2.5 py-1.5 text-content-secondary">{ETIQUETA_TAREA[m.task_type] ?? m.task_type}</td>
                  <td className="px-2.5 py-1.5 text-content-secondary">{m.algorithm ? ETIQUETA_MODELO[m.algorithm] ?? m.algorithm : "—"}</td>
                  <td className="px-2.5 py-1.5 text-content-secondary">{fmtNum(m.metrics.mae)}</td>
                  <td className="px-2.5 py-1.5 text-content-secondary">{fmtDateTimeUTC5(m.approved_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
