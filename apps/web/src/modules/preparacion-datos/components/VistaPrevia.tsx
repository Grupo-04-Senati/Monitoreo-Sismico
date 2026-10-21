import { useEffect, useState } from "react";
import { fmtDateTimeUTC5 } from "@/lib/format";
import Paginador from "@/modules/reportes/components/Paginador";
import type { PaginaFilas, Particion } from "../types";
import { ETIQUETA_REVISION } from "../schemas/datasets.schema";
import { filasDataset } from "../services/datasets.service";

const TAMANO = 25;

/** Vista previa de los eventos del dataset, con la imputación marcada. */
export default function VistaPrevia({ datasetId, conParticion }: { datasetId: string; conParticion: boolean }) {
  const [split, setSplit] = useState<Particion | "">("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<PaginaFilas | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    setError(false);
    filasDataset(datasetId, split, pagina, TAMANO)
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .catch(() => {
        if (vivo) setError(true);
      });
    return () => {
      vivo = false;
    };
  }, [datasetId, split, pagina]);

  return (
    <div>
      {conParticion && (
        <div className="mb-2 flex items-center gap-2 text-xs" role="group" aria-label="Partición">
          {(["", "entrenamiento", "prueba"] as const).map((s) => (
            <button
              key={s || "todas"}
              type="button"
              onClick={() => {
                setSplit(s);
                setPagina(1);
              }}
              className={`rounded-md border px-2.5 py-1 transition-colors ${
                split === s ? "border-accent-500 bg-accent-600 text-white" : "border-border text-content-secondary hover:bg-surface-tertiary"
              }`}
            >
              {s === "" ? "Todas" : s === "entrenamiento" ? "Entrenamiento" : "Prueba"}
            </button>
          ))}
        </div>
      )}

      {error && <p role="alert" className="py-6 text-center text-xs text-content-muted">No se pudo cargar la vista previa.</p>}
      {!error && !datos && <p className="py-6 text-center text-xs text-content-muted">Cargando…</p>}

      {datos && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <caption className="sr-only">Eventos incluidos en el dataset</caption>
              <thead>
                <tr className="border-b border-border bg-surface-secondary">
                  {["Fecha (UTC-5)", "ID externo", "Partición", "Lat.", "Lon.", "Prof. (km)", "Magnitud", "Revisión"].map((h) => (
                    <th key={h} scope="col" className="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-content-secondary">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datos.items.map((f) => (
                  <tr key={f.event_id} className="border-b border-border last:border-0">
                    <td className="px-2.5 py-1.5 text-content">{fmtDateTimeUTC5(f.occurred_at)}</td>
                    <td className="px-2.5 py-1.5 font-mono text-[11px] text-content-secondary">{f.external_id}</td>
                    <td className="px-2.5 py-1.5 text-content-secondary">{f.split ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-content-secondary">{f.latitude.toFixed(3)}</td>
                    <td className="px-2.5 py-1.5 text-content-secondary">{f.longitude.toFixed(3)}</td>
                    <td className="px-2.5 py-1.5 text-content-secondary">
                      {f.depth_km ?? "—"}
                      {f.depth_imputada && (
                        <span className="ml-1 rounded bg-surface-tertiary px-1 text-[10px] text-content-muted" title="Valor imputado con la mediana del dataset">
                          imputada
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-1.5 text-content-secondary">
                      {f.magnitude ?? "—"} {f.magnitude_type ?? ""}
                    </td>
                    <td className="px-2.5 py-1.5 text-content-secondary">{ETIQUETA_REVISION[f.review_status] ?? f.review_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2">
            <Paginador
              total={datos.total}
              pagina={datos.page}
              tamano={datos.page_size}
              totalPaginas={Math.max(1, Math.ceil(datos.total / datos.page_size))}
              unidad="eventos"
              onPagina={setPagina}
            />
          </div>
        </>
      )}
    </div>
  );
}
