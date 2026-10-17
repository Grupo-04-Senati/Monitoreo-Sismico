import { type ChartDatum } from "@/components/charts/BarChart";

interface HBarChartProps {
  data: ChartDatum[];
  /** altura total en px (se ignora con fill) */
  height?: number;
  /** Ocupa toda la altura disponible del contenedor (vista ampliada) */
  fill?: boolean;
  ariaLabel?: string;
  /** Clases de ancho para la columna de etiquetas */
  labelWidth?: string;
}

/**
 * Barras horizontales ordenadas por categoría: pensada para "Distribución por
 * magnitud", con etiquetas de rango largas y un diseño distinto al de las series.
 */
export default function HBarChart({
  data,
  height = 200,
  fill = false,
  ariaLabel,
  labelWidth = "w-24",
}: HBarChartProps) {
  if (!data.length || !data.some((d) => d.value > 0)) {
    return (
      <div className="flex items-center justify-center text-xs text-content-muted" style={{ height }}>
        Sin datos para mostrar.
      </div>
    );
  }

  const maxV = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div
      role="img"
      aria-label={ariaLabel ?? "Gráfico de barras horizontales"}
      className={fill ? "h-full min-h-0 flex flex-col" : ""}
      style={fill ? undefined : { height }}
    >
      <div
        className={`chart-plot rounded-lg p-2.5 ${
          fill ? "flex-1 min-h-0 flex flex-col gap-2" : "h-full flex flex-col gap-2"
        }`}
      >
        {data.map((d, i) => {
          const pct = (d.value / maxV) * 100;
          const inside = pct >= 28;
          return (
            <div key={i} className="group relative flex-1 min-h-[22px] flex items-center gap-2.5">
              <span className={`${labelWidth} shrink-0 text-right text-[11px] font-medium text-content-secondary`}>
                {d.label}
              </span>

              <div className="relative flex-1 h-full min-w-0 rounded bg-surface-tertiary">
                <div
                  className="absolute left-0 inset-y-[16%] rounded-r bg-gradient-to-r from-accent-600 to-accent-400 transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
                {d.value > 0 && (
                  <span
                    className={`absolute top-1/2 text-[10px] font-semibold ${inside ? "text-white" : "text-content-secondary"}`}
                    style={
                      inside
                        ? { left: `calc(${pct}% - 6px)`, transform: "translate(-100%, -50%)" }
                        : { left: `calc(${pct}% + 6px)`, transform: "translate(0, -50%)" }
                    }
                  >
                    {d.value}
                  </span>
                )}
              </div>

              {d.tip && d.tip.length > 0 && (
                <div
                  className={`hidden group-hover:block absolute left-1/2 -translate-x-1/2 z-30 w-max max-w-[240px] bg-surface border border-border rounded-md shadow-lg px-2.5 py-1.5 text-[11px] text-content text-left pointer-events-none ${
                    i === 0 ? "top-full mt-1" : "bottom-full mb-1"
                  }`}
                >
                  {d.tip.map((t, ti) => (
                    <div key={ti} className={ti === 0 ? "font-semibold" : "text-content-secondary"}>
                      {t}
                    </div>
                  ))}
                  <div className="text-content-muted">{((d.value / total) * 100).toFixed(1)}% del total</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
