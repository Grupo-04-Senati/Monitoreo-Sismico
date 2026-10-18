import { COLOR_PUNTO, escalaCian, radioMagnitud } from "../lib/geo";
import { IconInfo, IconMapPin } from "@/components/ui/Icons";

interface LeyendaMapaProps {
  maxEventos: number;
  fuente: string;
  actualizado: string;
  mostrarRegiones: boolean;
  mostrarEventos: boolean;
}

const TAMANOS = [3, 4, 5];

/**
 * Leyenda del mapa: una sola gama de color (cian), escala por cantidad de
 * eventos, tamaños por magnitud (M3–M5) y la procedencia/hora de actualización.
 */
export default function LeyendaMapa({ maxEventos, fuente, actualizado, mostrarRegiones, mostrarEventos }: LeyendaMapaProps) {
  const tramos = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="mt-2.5 flex flex-wrap items-start gap-x-6 gap-y-3 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[11px] text-content-secondary">
      {mostrarRegiones && (
        <div>
          <span className="mb-1 block text-[10px] uppercase tracking-[0.04em] text-content-muted">Eventos por región</span>
          <div className="flex items-center gap-1.5">
            <span className="tabular-nums text-content-muted">0</span>
            <span className="flex overflow-hidden rounded-sm border border-border">
              {tramos.slice(1).map((t) => (
                <span key={t} aria-hidden="true" className="block h-3 w-6" style={{ backgroundColor: escalaCian(t) }} />
              ))}
            </span>
            <span className="tabular-nums text-content-muted">{maxEventos}</span>
          </div>
        </div>
      )}

      {mostrarEventos && (
        <div>
          <span className="mb-1 block text-[10px] uppercase tracking-[0.04em] text-content-muted">Tamaño por magnitud</span>
          <div className="flex items-center gap-3">
            {TAMANOS.map((m) => (
              <span key={m} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block rounded-full border border-white"
                  style={{ width: radioMagnitud(m) * 2, height: radioMagnitud(m) * 2, backgroundColor: COLOR_PUNTO }}
                />
                <span className="tabular-nums text-content-muted">M{m}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="ml-auto flex flex-col gap-0.5 text-content-muted">
        <span className="flex items-center gap-1.5">
          <IconMapPin size={12} />
          Fuente: <b className="font-medium text-content-secondary">{fuente}</b>
        </span>
        <span className="flex items-center gap-1.5">
          <IconInfo size={12} />
          Actualizado: <b className="font-medium text-content-secondary">{actualizado}</b> (UTC-5)
        </span>
      </div>
    </div>
  );
}
