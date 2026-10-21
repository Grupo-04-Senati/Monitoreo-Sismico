import type { EstadoEstimacion } from "../types";
import { CLASE_EXPERIMENTAL, COLOR_ESTADO, ETIQUETA_ESTADO, SIMBOLO_ESTADO } from "../schemas/estimaciones.schema";

/** Etiqueta "Estimación experimental" + estado de revisión (sin semáforo). */
export default function InsigniaEstimacion({ estado }: { estado: EstadoEstimacion }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${CLASE_EXPERIMENTAL}`}>
        Estimación experimental
      </span>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${COLOR_ESTADO[estado]}`}>
        <span aria-hidden="true">{SIMBOLO_ESTADO[estado]}</span>
        {ETIQUETA_ESTADO[estado]}
      </span>
    </span>
  );
}
