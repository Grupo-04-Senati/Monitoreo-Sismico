import Card from "@/components/ui/Card";
import { fmtTimeUTC5 } from "@/lib/format";
import type { EstadoComprobacion, EstadoSistema } from "../types";

/* Colores neutros: es estado técnico de la plataforma, no un nivel de peligro sísmico. */
const ESTILO: Record<EstadoComprobacion, { simbolo: string; etiqueta: string; clase: string }> = {
  ok: { simbolo: "✓", etiqueta: "Correcto", clase: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200" },
  aviso: { simbolo: "◐", etiqueta: "Revisar", clase: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100" },
  critico: { simbolo: "●", etiqueta: "Atención", clase: "bg-slate-700 font-semibold text-white dark:bg-slate-200 dark:text-slate-900" },
  sin_datos: { simbolo: "○", etiqueta: "Sin datos", clase: "border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300" },
};

const GENERAL: Record<EstadoSistema["estado"], string> = {
  ok: "Todo funciona con normalidad",
  degradado: "Funciona, con puntos por revisar",
  critico: "Hay problemas que requieren atención",
};

interface PanelEstadoProps {
  estado: EstadoSistema | null;
  cargando: boolean;
  onActualizar: () => void;
}

/** Estado operativo: base, ingesta, ejecuciones, avisos, latencia y copias. */
export default function PanelEstado({ estado, cargando, onActualizar }: PanelEstadoProps) {
  return (
    <Card
      title="Estado del sistema"
      help="Comprobaciones en vivo de la plataforma (PDF §12). La latencia se mide desde el último arranque de la API."
      action={
        <button
          type="button"
          onClick={onActualizar}
          disabled={cargando}
          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-content transition-colors hover:bg-surface-tertiary disabled:opacity-40"
        >
          {cargando ? "Comprobando…" : "Comprobar ahora"}
        </button>
      }
    >
      {!estado ? (
        <p className="text-xs text-content-muted">{cargando ? "Comprobando…" : "No se pudo obtener el estado."}</p>
      ) : (
        <>
          <p className="mb-3 text-sm font-semibold text-content">
            {GENERAL[estado.estado]}
            <span className="ml-2 text-[11px] font-normal text-content-muted">a las {fmtTimeUTC5(estado.generado_en)} (UTC-5)</span>
          </p>
          <ul className="divide-y divide-border">
            {estado.comprobaciones.map((c) => {
              const e = ESTILO[c.estado] ?? ESTILO.sin_datos;
              return (
                <li key={c.clave} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
                  <span className={`inline-flex w-24 shrink-0 items-center justify-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${e.clase}`}>
                    <span aria-hidden="true">{e.simbolo}</span>
                    {e.etiqueta}
                  </span>
                  <span className="min-w-[160px] text-xs font-medium text-content">{c.nombre}</span>
                  <span className="flex-1 text-xs text-content-secondary">{c.detalle}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}
