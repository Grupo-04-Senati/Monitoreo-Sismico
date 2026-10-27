import { useMemo } from "react";
import type { EjecucionFuente, ResumenFuente } from "../types";
import type { SeccionFuente } from "../kpis";
import { KPIS, detalleUltimoExito } from "../kpis";
import { resumenPorHora } from "../services/fuentes.service";
import Sparkline from "@/components/charts/Sparkline";
import { IconExpand } from "@/components/ui/Icons";

const DOT: Record<ResumenFuente["estadoConector"], string> = {
  operativo: "bg-green-600",
  degradado: "bg-amber-500",
  sin_conexion: "bg-red-600",
};

/** Tarjeta individual de resumen; abre la vista ampliada del indicador. */
function Tarjeta({
  etiqueta,
  valor,
  detalle,
  serie,
  dot,
  onClick,
}: {
  etiqueta: string;
  valor: string;
  detalle: string;
  serie: number[];
  dot?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={`Ampliar indicador: ${etiqueta}`}
      className={`auth-surface tilt group relative flex flex-col rounded-[10px] border border-border bg-surface px-3.5 py-3 text-left transition-all ${
        onClick ? "cursor-pointer hover:-translate-y-0.5 hover:border-accent-500/60 hover:bg-surface-tertiary hover:shadow-md" : "cursor-default"
      }`}
    >
      {onClick && (
        <span className="absolute right-2 top-2 text-content-muted opacity-0 transition-opacity group-hover:opacity-70" aria-hidden="true">
          <IconExpand size={12} />
        </span>
      )}
      <small className="block text-[10px] uppercase tracking-[0.04em] text-content-muted">{etiqueta}</small>
      <b className="flex items-center gap-1.5 text-[24px] font-bold leading-tight text-content">
        {dot && <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />}
        {valor}
      </b>
      <span className="block text-[11px] text-content-muted">{detalle}</span>
      <span className="mt-auto block pt-1.5">
        <Sparkline values={serie} height={26} className="w-full" />
      </span>
    </button>
  );
}

/** Seis tarjetas con el estado del conector y la ingesta de la ventana observada. */
export default function TarjetasFuente({
  resumen,
  ventana,
  onAbrir,
}: {
  resumen: ResumenFuente | null;
  ventana: EjecucionFuente[];
  onAbrir?: (seccion: SeccionFuente) => void;
}) {
  const horas = useMemo(() => resumenPorHora(ventana), [ventana]);

  const detalle = (i: number): string => {
    if (!resumen) return "—";
    if (i === 0) return resumen.estadoConectorDetalle;
    if (i === 1) return detalleUltimoExito(resumen);
    if (KPIS[i].metrica === "insertados") return `${KPIS[i].detalle} · ${resumen.registrosCorregidos.toLocaleString("es-PE")} corregidos`;
    return KPIS[i].detalle;
  };

  return (
    <div className="mb-3 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
      {KPIS.map((k, i) => (
        <Tarjeta
          key={k.etiqueta}
          etiqueta={k.etiqueta}
          valor={resumen ? k.valor(resumen) : "—"}
          detalle={detalle(i)}
          serie={horas.map((h) => h[k.metrica])}
          dot={i === 0 && resumen ? DOT[resumen.estadoConector] : undefined}
          onClick={onAbrir ? () => onAbrir(`kpi-${i}` as SeccionFuente) : undefined}
        />
      ))}
    </div>
  );
}
