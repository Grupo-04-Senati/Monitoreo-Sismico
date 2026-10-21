import type { EstadoExperimento } from "../types";
import { COLOR_ESTADO, ETIQUETA_ESTADO, SIMBOLO_ESTADO } from "../schemas/ml.schema";

/** Insignia del estado de un experimento (sin semáforo: símbolo + etiqueta). */
export default function InsigniaEstadoExperimento({ estado, aprobado = false }: { estado: EstadoExperimento; aprobado?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${COLOR_ESTADO[estado]}`}>
        <span aria-hidden="true">{SIMBOLO_ESTADO[estado]}</span>
        {ETIQUETA_ESTADO[estado]}
      </span>
      {aprobado && (
        <span className="inline-flex items-center rounded-full border border-accent-500 px-2 py-0.5 text-[11px] font-medium text-accent-700 dark:text-accent-300">
          Modelo aprobado
        </span>
      )}
    </span>
  );
}
