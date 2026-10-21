import { fmtDateTimeUTC5 } from "@/lib/format";
import Paginador from "@/modules/reportes/components/Paginador";
import type { Experimento, PaginaExperimentos } from "../types";
import { ES_REFERENCIA, ETIQUETA_MODELO, ETIQUETA_TAREA, fmtMejora, fmtNum } from "../schemas/ml.schema";
import InsigniaEstadoExperimento from "./InsigniaEstadoExperimento";

interface TablaExperimentosProps {
  datos: PaginaExperimentos | null;
  cargando: boolean;
  onAbrir: (experimento: Experimento) => void;
  onPagina: (n: number) => void;
}

/** Registro de experimentos. Clic en una fila abre el detalle. */
export default function TablaExperimentos({ datos, cargando, onAbrir, onPagina }: TablaExperimentosProps) {
  if (cargando && !datos) {
    return <div className="py-10 text-center text-sm text-content-muted">Cargando experimentos…</div>;
  }
  if (!datos) return null;
  if (datos.items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface py-12 text-center">
        <p className="text-sm font-medium text-content">Aún no hay experimentos</p>
        <p className="mt-0.5 text-xs text-content-muted">Entrena el primero con el formulario de arriba.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">Registro de experimentos de ML</caption>
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              {["Experimento", "Tarea", "Estado", "Mejor resultado", "MAE (prueba)", "Frente a la media", "Creado"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-content-secondary">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.items.map((e) => {
              const mejor = e.algorithm;
              const mejora = mejor && !ES_REFERENCIA(mejor) ? e.results.mejora?.[mejor]?.referencia_media : null;
              return (
                <tr
                  key={e.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => onAbrir(e)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      onAbrir(e);
                    }
                  }}
                  className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-surface-tertiary focus:bg-surface-tertiary focus:outline-none"
                >
                  <td className="px-3 py-2.5 font-medium text-content">{e.name}</td>
                  <td className="px-3 py-2.5 text-content-secondary">{ETIQUETA_TAREA[e.task_type] ?? e.task_type}</td>
                  <td className="px-3 py-2.5"><InsigniaEstadoExperimento estado={e.status} aprobado={!!e.model_id} /></td>
                  <td className="px-3 py-2.5 text-content-secondary">{mejor ? ETIQUETA_MODELO[mejor] ?? mejor : "—"}</td>
                  <td className="px-3 py-2.5 text-content-secondary">{mejor ? fmtNum(e.metrics[mejor]?.mae) : "—"}</td>
                  <td className="px-3 py-2.5 text-content-secondary">{fmtMejora(mejora)}</td>
                  <td className="px-3 py-2.5 text-content-secondary">{fmtDateTimeUTC5(e.created_at)}</td>
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
          unidad="experimentos"
          onPagina={onPagina}
        />
      </div>
    </>
  );
}
