import type { EstadoDataset } from "../types";
import { COLOR_ESTADO, ETIQUETA_ESTADO, SIMBOLO_ESTADO } from "../schemas/datasets.schema";

/** Insignia del estado de un dataset (sin semáforo: símbolo + etiqueta). */
export default function InsigniaEstadoDataset({ estado }: { estado: EstadoDataset }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${COLOR_ESTADO[estado]}`}>
      <span aria-hidden="true">{SIMBOLO_ESTADO[estado]}</span>
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}
