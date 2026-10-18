import Card from "@/components/ui/Card";
import type { ConteoTipoEstadoReporte, EstadoReporte } from "../types";
import { BARRA_ESTADO, ESTADOS_REPORTE, ETIQUETA_ESTADO } from "../schemas/reportes.schema";

interface GraficoReportesProps {
  conteos: ConteoTipoEstadoReporte[];
  onSegmento: (tipo: ConteoTipoEstadoReporte["tipo"], estado: EstadoReporte) => void;
}

/** Distribución de informes por tipo, con sus estados apilados. */
export default function GraficoReportes({ conteos, onSegmento }: GraficoReportesProps) {
  const maxTotal = Math.max(...conteos.map((c) => c.total), 1);
  const conDatos = conteos.filter((c) => c.total > 0);

  return (
    <Card
      title="Informes por tipo y estado"
      help="Haz clic en un segmento para ver los informes de ese tipo y estado."
    >
      {conDatos.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-xs text-content-muted">
          Sin informes para mostrar.
        </div>
      ) : (
        <>
          <div
            role="img"
            aria-label="Distribución de informes por tipo y estado"
            className="chart-plot flex flex-col gap-2.5 rounded-lg p-2.5"
          >
            {conteos.map((c) => (
              <div key={c.tipo} className="flex items-center gap-2.5">
                <span className="w-36 shrink-0 text-right text-[11px] font-medium text-content-secondary">
                  {c.nombre}
                </span>
                <div className="relative flex h-6 flex-1 min-w-0 overflow-hidden rounded bg-surface-tertiary">
                  {c.total === 0 ? (
                    <span className="flex h-full w-full items-center justify-center text-[10px] text-content-muted">
                      sin informes
                    </span>
                  ) : (
                    <div className="flex h-full" style={{ width: `${(c.total / maxTotal) * 100}%` }}>
                      {ESTADOS_REPORTE.map((estado) => {
                        const n = c.estados[estado];
                        if (!n) return null;
                        return (
                          <button
                            key={estado}
                            type="button"
                            onClick={() => onSegmento(c.tipo, estado)}
                            title={`${c.nombre} · ${ETIQUETA_ESTADO[estado]}: ${n}`}
                            aria-label={`${c.nombre}, ${ETIQUETA_ESTADO[estado]}: ${n} informe(s). Ver lista.`}
                            className={`h-full ${BARRA_ESTADO[estado]} transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white`}
                            style={{ width: `${(n / c.total) * 100}%` }}
                          />
                        );
                      })}
                    </div>
                  )}
                  {c.total > 0 && (
                    <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-content-secondary">
                      {c.total}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {ESTADOS_REPORTE.map((estado) => (
              <li key={estado} className="flex items-center gap-1.5 text-[11px] text-content-secondary">
                <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-sm ${BARRA_ESTADO[estado]}`} />
                {ETIQUETA_ESTADO[estado]}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
