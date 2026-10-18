import { fmtDateTimeUTC5 } from "@/lib/format";
import { IconDownload } from "@/components/ui/Icons";
import type { PaginaReportes, Reporte } from "../types";
import { ETIQUETA_TIPO, TTL_HORAS } from "../schemas/reportes.schema";
import { estaExpirado, horasHastaExpirar, puedeDescargar } from "../services/reportes.service";
import InsigniaEstado from "./InsigniaEstado";
import Paginador from "./Paginador";

interface TablaReportesProps {
  datos: PaginaReportes | null;
  cargando: boolean;
  onAbrir: (reporte: Reporte) => void;
  onPagina: (n: number) => void;
  onDescargar: (reporte: Reporte) => void;
}

function textoExpira(r: Reporte): string {
  if (r.estado === "expirado" || estaExpirado(r)) return "Expirado";
  if (r.estado !== "listo" || !r.expiraUtc) return "—";
  const horas = horasHastaExpirar(r);
  const base = fmtDateTimeUTC5(r.expiraUtc);
  return horas != null && horas <= TTL_HORAS ? `${base} (${Math.max(0, Math.round(horas))} h)` : base;
}

/** Tabla principal del módulo. Clic en una fila abre el detalle del informe. */
export default function TablaReportes({ datos, cargando, onAbrir, onPagina, onDescargar }: TablaReportesProps) {
  if (cargando && !datos) {
    return <div className="py-10 text-center text-sm text-content-muted">Cargando informes…</div>;
  }
  if (!datos) return null;

  if (datos.filas.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface py-12 text-center">
        <p className="text-sm font-medium text-content">Sin resultados</p>
        <p className="mt-0.5 text-xs text-content-muted">Ajusta los filtros o solicita un informe nuevo.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">Lista de informes solicitados</caption>
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              {["Informe", "Tipo", "Estado", "Solicitante", "Corte", "Creado", "Filas", "Expira", "Descargar"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-content-secondary">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.filas.map((r) => {
              const descargable = puedeDescargar(r);
              return (
                <tr
                  key={r.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => onAbrir(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onAbrir(r);
                    }
                  }}
                  className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-surface-tertiary focus:bg-surface-tertiary focus:outline-none"
                >
                  <td className="px-3 py-2.5 font-medium text-content">{r.nombre}</td>
                  <td className="px-3 py-2.5 text-content-secondary">{ETIQUETA_TIPO[r.tipo]}</td>
                  <td className="px-3 py-2.5"><InsigniaEstado estado={r.estado} /></td>
                  <td className="px-3 py-2.5 text-content-secondary">{r.solicitante}</td>
                  <td className="px-3 py-2.5 text-content-secondary">{fmtDateTimeUTC5(r.corteUtc)}</td>
                  <td className="px-3 py-2.5 text-content-secondary">{fmtDateTimeUTC5(r.creadoUtc)}</td>
                  <td className="px-3 py-2.5 text-content-secondary">{r.filas ?? "—"}</td>
                  <td className="px-3 py-2.5 text-content-secondary">{textoExpira(r)}</td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDescargar(r);
                      }}
                      disabled={!descargable}
                      title={descargable ? "Descargar el informe" : estaExpirado(r) ? "El enlace expiró" : "Aún no está listo"}
                      aria-label="Descargar informe"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-content-secondary transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <IconDownload size={13} />
                      Descargar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        <Paginador
          total={datos.total}
          pagina={datos.pagina}
          tamano={datos.tamano}
          totalPaginas={datos.totalPaginas}
          unidad="informes"
          onPagina={onPagina}
        />
      </div>
    </>
  );
}
