import { fmtDateTimeUTC5 } from "@/lib/format";
import Paginador from "@/modules/reportes/components/Paginador";
import type { Dataset, PaginaDatasets } from "../types";
import { fmtDiaUTC } from "../schemas/datasets.schema";
import InsigniaEstadoDataset from "./InsigniaEstadoDataset";

interface TablaDatasetsProps {
  datos: PaginaDatasets | null;
  cargando: boolean;
  onAbrir: (dataset: Dataset) => void;
  onPagina: (n: number) => void;
}

function particion(d: Dataset): string {
  const p = d.quality_report?.particion;
  if (!p?.fecha_corte) return "Sin partición";
  return `${p.entrenamiento.toLocaleString("es-PE")} / ${p.prueba.toLocaleString("es-PE")}`;
}

/** Lista de datasets. Clic en una fila abre el informe de calidad. */
export default function TablaDatasets({ datos, cargando, onAbrir, onPagina }: TablaDatasetsProps) {
  if (cargando && !datos) {
    return <div className="py-10 text-center text-sm text-content-muted">Cargando datasets…</div>;
  }
  if (!datos) return null;

  if (datos.items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface py-12 text-center">
        <p className="text-sm font-medium text-content">Aún no hay datasets</p>
        <p className="mt-0.5 text-xs text-content-muted">Crea el primero con el formulario de arriba.</p>
      </div>
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(datos.total / datos.page_size));

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">Lista de datasets versionados</caption>
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              {["Dataset", "Versión", "Estado", "Periodo (UTC)", "Filas", "Entrenamiento / prueba", "Advertencias", "Creado"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-content-secondary">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.items.map((d) => (
              <tr
                key={d.id}
                tabIndex={0}
                role="button"
                onClick={() => onAbrir(d)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onAbrir(d);
                  }
                }}
                className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-surface-tertiary focus:bg-surface-tertiary focus:outline-none"
              >
                <td className="px-3 py-2.5 font-medium text-content">{d.name}</td>
                <td className="px-3 py-2.5 text-content-secondary">v{d.version}</td>
                <td className="px-3 py-2.5"><InsigniaEstadoDataset estado={d.status} /></td>
                <td className="px-3 py-2.5 text-content-secondary">
                  {fmtDiaUTC(d.period_start)} – {fmtDiaUTC(d.period_end)}
                </td>
                <td className="px-3 py-2.5 text-content-secondary">{d.row_count.toLocaleString("es-PE")}</td>
                <td className="px-3 py-2.5 text-content-secondary">{particion(d)}</td>
                <td className="px-3 py-2.5 text-content-secondary">{d.quality_report?.advertencias?.length ?? 0}</td>
                <td className="px-3 py-2.5 text-content-secondary">{fmtDateTimeUTC5(d.created_at)}</td>
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
          totalPaginas={totalPaginas}
          unidad="datasets"
          onPagina={onPagina}
        />
      </div>
    </>
  );
}
