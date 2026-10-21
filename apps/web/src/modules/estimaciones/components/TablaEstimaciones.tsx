import { fmtDateTimeUTC5 } from "@/lib/format";
import Paginador from "@/modules/reportes/components/Paginador";
import type { Estimacion, PaginaEstimaciones } from "../types";
import { fmtValor, fmtVentana } from "../schemas/estimaciones.schema";
import BarraIntervalo from "./BarraIntervalo";
import InsigniaEstimacion from "./InsigniaEstimacion";

interface TablaEstimacionesProps {
  datos: PaginaEstimaciones | null;
  cargando: boolean;
  onAbrir: (e: Estimacion) => void;
  onPagina: (n: number) => void;
}

/** Lista de estimaciones. Clic en una fila abre el detalle. */
export default function TablaEstimaciones({ datos, cargando, onAbrir, onPagina }: TablaEstimacionesProps) {
  if (cargando && !datos) return <div className="py-10 text-center text-sm text-content-muted">Cargando estimaciones…</div>;
  if (!datos) return null;
  if (datos.items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface py-12 text-center">
        <p className="text-sm font-medium text-content">Aún no hay estimaciones</p>
        <p className="mt-0.5 text-xs text-content-muted">Genera la primera con un modelo aprobado.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">Estimaciones experimentales</caption>
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              {["Semana (UTC)", "Modelo", "Estimación", "Intervalo", "Media hist.", "Estado", "Calculada"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-content-secondary">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.items.map((e) => (
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
                <td className="px-3 py-2.5 text-content">{fmtVentana(e.window_start, e.window_end)}</td>
                <td className="px-3 py-2.5 text-content-secondary">
                  {e.model_name ? `${e.model_name} · v${e.model_version}` : "—"}
                </td>
                <td className="px-3 py-2.5 font-semibold text-content">{fmtValor(e.value)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2 text-[11px] text-content-secondary">
                    <BarraIntervalo valor={e.value} inferior={e.lower_bound} superior={e.upper_bound} referencia={e.reference_value} nivel={e.confidence_level} compacta />
                    {fmtValor(e.lower_bound)}–{fmtValor(e.upper_bound)}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-content-secondary">{fmtValor(e.reference_value)}</td>
                <td className="px-3 py-2.5"><InsigniaEstimacion estado={e.status} /></td>
                <td className="px-3 py-2.5 text-content-secondary">{fmtDateTimeUTC5(e.calculated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        <Paginador
          total={datos.total}
          pagina={datos.page}
          tamano={datos.page_size}
          totalPaginas={Math.max(1, Math.ceil(datos.total / datos.page_size))}
          unidad="estimaciones"
          onPagina={onPagina}
        />
      </div>
    </>
  );
}
