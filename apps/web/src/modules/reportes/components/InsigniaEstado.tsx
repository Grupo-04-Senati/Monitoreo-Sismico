import type { EstadoReporte } from "../types";
import { COLOR_ESTADO, ETIQUETA_ESTADO, SIMBOLO_ESTADO } from "../schemas/reportes.schema";

/** Insignia del estado de un informe (sin semáforo: símbolo + etiqueta). */
export default function InsigniaEstado({ estado }: { estado: EstadoReporte }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${COLOR_ESTADO[estado]}`}>
      <span aria-hidden="true">{SIMBOLO_ESTADO[estado]}</span>
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}
