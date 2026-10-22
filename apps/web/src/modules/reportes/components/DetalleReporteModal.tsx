import ExpandModal from "@/components/ui/ExpandModal";
import { IconDownload, IconInfo } from "@/components/ui/Icons";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { Reporte } from "../types";
import { ETIQUETA_TIPO, etiquetaZona, type ZonaOption } from "../schemas/reportes.schema";
import { estaExpirado, filtrosTexto, metadatosReporte, periodoTexto, puedeDescargar } from "../services/reportes.service";
import InsigniaEstado from "./InsigniaEstado";

interface DetalleReporteModalProps {
  reporte: Reporte;
  zonas: ZonaOption[];
  onDescargar: (reporte: Reporte) => void;
  onCerrar: () => void;
}

function tamano(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Detalle completo de un informe: parámetros, historial y metadatos. */
export default function DetalleReporteModal({ reporte, zonas, onDescargar, onCerrar }: DetalleReporteModalProps) {
  const descargable = puedeDescargar(reporte);
  const expirado = estaExpirado(reporte);

  const datos: [string, string][] = [
    ["Tipo", ETIQUETA_TIPO[reporte.tipo]],
    ["Formato", reporte.formato.toUpperCase()],
    ["Solicitante", reporte.solicitante],
    ["Fuente", reporte.fuente],
    ["Fecha de corte", fmtDateTimeUTC5(reporte.corteUtc)],
    ["Creado", fmtDateTimeUTC5(reporte.creadoUtc)],
    ["Inicio", reporte.iniciadoUtc ? fmtDateTimeUTC5(reporte.iniciadoUtc) : "—"],
    ["Fin", reporte.terminadoUtc ? fmtDateTimeUTC5(reporte.terminadoUtc) : "—"],
    ["Expira", reporte.expiraUtc ? fmtDateTimeUTC5(reporte.expiraUtc) : "—"],
    ["Filas", reporte.filas != null ? reporte.filas.toLocaleString("es-PE") : "—"],
    ["Tamaño", tamano(reporte.tamanoBytes)],
    ["Periodo", periodoTexto(reporte.parametros)],
    ["Zona", etiquetaZona(reporte.parametros.zona, zonas)],
    ["Filtros", filtrosTexto(reporte.parametros)],
  ];

  const pie = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-content-muted">
        {expirado
          ? "El enlace expiró: solicita el informe de nuevo."
          : descargable
            ? `Enlace vigente hasta ${reporte.expiraUtc ? fmtDateTimeUTC5(reporte.expiraUtc) : "—"} (UTC-5).`
            : "El enlace estará disponible cuando el informe esté listo."}
      </span>
      <button
        type="button"
        onClick={() => onDescargar(reporte)}
        disabled={!descargable}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <IconDownload size={13} />
        Descargar
      </button>
    </div>
  );

  return (
    <ExpandModal title={reporte.nombre} onClose={onCerrar} footer={pie} resizable>
      {() => (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <InsigniaEstado estado={reporte.estado} />
            <span className="text-xs text-content-muted">ID {reporte.id}</span>
          </div>

          {reporte.estado === "fallido" && reporte.error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2 text-[11px] text-content-secondary">
              <IconInfo size={13} className="mt-0.5 shrink-0 text-rose-600" />
              {reporte.error}
            </p>
          )}

          <section>
            <h3 className="mb-1.5 text-sm font-semibold text-content">Parámetros y datos</h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
              {datos.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-border py-1 last:border-0">
                  <dt className="text-content-muted">{k}</dt>
                  <dd className="text-right font-medium text-content-secondary">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold text-content">Historial</h3>
            <ol className="flex flex-col gap-1 text-xs text-content-secondary">
              {reporte.historial.map((h, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span aria-hidden="true" className="text-content-muted">•</span>
                  <InsigniaEstado estado={h.estado} />
                  <span className="text-content-muted">{fmtDateTimeUTC5(h.horaUtc)} (UTC-5)</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="flex min-h-0 flex-1 flex-col">
            <h3 className="mb-1.5 text-sm font-semibold text-content">Vista previa del contenido</h3>
            <p className="rounded-lg border border-border bg-surface px-3 py-6 text-center text-xs text-content-muted">
              La vista previa de filas no está disponible: descarga el informe para ver su contenido.
            </p>
            <p className="mt-1.5 text-[10px] text-content-muted">
              Metadatos del informe: {metadatosReporte(reporte).map(([k, v]) => `${k}: ${v}`).join(" · ")}
            </p>
          </section>
        </div>
      )}
    </ExpandModal>
  );
}
