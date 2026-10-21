import type { EstadoAviso, Severidad } from "../types";
import { COLOR_ESTADO, COLOR_SEVERIDAD, ETIQUETA_ESTADO, ETIQUETA_SEVERIDAD, SIMBOLO_SEVERIDAD } from "../schemas/alertas.schema";

const base = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px]";

export function InsigniaSeveridad({ severidad }: { severidad: Severidad }) {
  return (
    <span className={`${base} ${COLOR_SEVERIDAD[severidad]}`}>
      <span aria-hidden="true">{SIMBOLO_SEVERIDAD[severidad]}</span>
      {ETIQUETA_SEVERIDAD[severidad]}
    </span>
  );
}

export function InsigniaEstado({ estado }: { estado: EstadoAviso }) {
  return <span className={`${base} font-medium ${COLOR_ESTADO[estado]}`}>{ETIQUETA_ESTADO[estado]}</span>;
}

export function InsigniaRegla({ activa }: { activa: boolean }) {
  return (
    <span
      className={`${base} font-medium ${
        activa
          ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      <span aria-hidden="true">{activa ? "●" : "○"}</span>
      {activa ? "Activa" : "Inactiva"}
    </span>
  );
}
