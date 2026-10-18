import ExpandModal from "@/components/ui/ExpandModal";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { Reporte } from "../types";
import { ETIQUETA_TIPO } from "../schemas/reportes.schema";
import InsigniaEstado from "./InsigniaEstado";

interface ModalListaReportesProps {
  titulo: string;
  descripcion?: string;
  reportes: Reporte[];
  onAbrir: (reporte: Reporte) => void;
  onCerrar: () => void;
}

/** Modal con la lista de informes que representa un indicador o un segmento. */
export default function ModalListaReportes({ titulo, descripcion, reportes, onAbrir, onCerrar }: ModalListaReportesProps) {
  return (
    <ExpandModal title={titulo} onClose={onCerrar} footer={<span className="text-content-muted">{reportes.length} informe(s)</span>}>
      {descripcion && <p className="mb-3 text-xs text-content-secondary">{descripcion}</p>}

      {reportes.length === 0 ? (
        <p className="py-10 text-center text-sm text-content-muted">No hay informes en este grupo.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-secondary">
                {["Informe", "Tipo", "Estado", "Solicitante", "Corte", "Filas"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-content-secondary">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportes.map((r) => (
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
                  <td className="px-3 py-2 font-medium text-content">{r.nombre}</td>
                  <td className="px-3 py-2 text-content-secondary">{ETIQUETA_TIPO[r.tipo]}</td>
                  <td className="px-3 py-2"><InsigniaEstado estado={r.estado} /></td>
                  <td className="px-3 py-2 text-content-secondary">{r.solicitante}</td>
                  <td className="px-3 py-2 text-content-secondary">{fmtDateTimeUTC5(r.corteUtc)}</td>
                  <td className="px-3 py-2 text-content-secondary">{r.filas ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ExpandModal>
  );
}
