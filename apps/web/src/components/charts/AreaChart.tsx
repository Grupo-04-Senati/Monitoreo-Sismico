import { useId } from "react";
import { niceScale, type ChartDatum } from "@/components/charts/BarChart";

interface AreaChartProps {
  data: ChartDatum[];
  /** altura del área de trazado en px (se ignora con fill) */
  height?: number;
  /** Ocupa toda la altura disponible del contenedor (vista ampliada) */
  fill?: boolean;
  ariaLabel?: string;
}

/**
 * Serie temporal como área con línea suave: pensada para "Eventos por día",
 * distinta del diseño de barras usado para magnitudes.
 */
export default function AreaChart({ data, height = 200, fill = false, ariaLabel }: AreaChartProps) {
  const gid = useId().replace(/:/g, "");

  if (!data.length || !data.some((d) => d.value > 0)) {
    return (
      <div className="flex items-center justify-center text-xs text-content-muted" style={{ height }}>
        Sin datos para mostrar.
      </div>
    );
  }

  const maxV = Math.max(...data.map((d) => d.value), 1);
  const { top, ticks } = niceScale(maxV);
  const n = data.length;

  /* Coordenadas en % (independientes de la altura real del contenedor) */
  const fx = (i: number) => ((i + 0.5) / n) * 100;
  const fy = (v: number) => (top ? v / top : 0) * 100;

  const pts = data.map((d, i) => ({ x: fx(i), y: fy(d.value) }));
  const line = pts
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${100 - p.y}`;
      const a = pts[i - 1];
      const cx = (p.x - a.x) / 3;
      return `C ${a.x + cx} ${100 - a.y}, ${p.x - cx} ${100 - p.y}, ${p.x} ${100 - p.y}`;
    })
    .join(" ");
  const area = `${line} L ${pts[pts.length - 1].x} 100 L ${pts[0].x} 100 Z`;

  const showValues = data.length <= 14;

  return (
    <div role="img" aria-label={ariaLabel ?? "Gráfico de área"} className={fill ? "h-full min-h-0 flex flex-col" : ""}>
      <div className={fill ? "flex gap-2 flex-1 min-h-0" : "flex gap-2"} style={fill ? undefined : { height }}>
        {/* Eje Y */}
        <div className="relative w-8 shrink-0">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 text-[10px] leading-none text-content-muted"
              style={{ bottom: `calc(${fy(t)}% - 4px)` }}
            >
              {t}
            </span>
          ))}
        </div>

        {/* Trazado */}
        <div className="chart-plot relative flex-1 min-w-0">
          {ticks.map((t) => (
            <div key={t} className="chart-grid-line absolute left-0 right-0 border-t" style={{ bottom: `${fy(t)}%` }} />
          ))}

          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-500)" stopOpacity="0.42" />
                <stop offset="100%" stopColor="var(--accent-500)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#area-${gid})`} />
            <path
              d={line}
              fill="none"
              stroke="var(--accent-500)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Puntos, valores y tooltips (columnas transparentes) */}
          <div className="absolute inset-0 flex">
            {data.map((d, i) => (
              <div key={i} className="relative flex-1 min-w-0 group">
                <span
                  className="absolute left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent-500 ring-1 ring-[var(--chart-bg)]"
                  style={{ bottom: `${fy(d.value)}%` }}
                />
                {showValues && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 text-[9px] font-semibold leading-none text-content-secondary"
                    style={{ bottom: `calc(${fy(d.value)}% + 7px)` }}
                  >
                    {d.value}
                  </span>
                )}
                {d.tip && d.tip.length > 0 && (
                  <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 z-30 mb-1 w-max max-w-[240px] bg-surface border border-border rounded-md shadow-lg px-2.5 py-1.5 text-[11px] text-content text-left pointer-events-none">
                    {d.tip.map((t, ti) => (
                      <div key={ti} className={ti === 0 ? "font-semibold" : "text-content-secondary"}>
                        {t}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Eje X */}
      <div className="flex gap-2 mt-1 shrink-0">
        <div className="w-8 shrink-0" />
        <div className="flex-1 min-w-0 flex">
          {data.map((d, i) => (
            <span key={i} className="flex-1 min-w-0 text-center text-[9px] leading-tight text-content-muted truncate">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
