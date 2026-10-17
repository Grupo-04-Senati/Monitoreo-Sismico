import { useEffect, useRef, useState } from "react";

export interface ChartDatum {
  label: string;
  value: number;
  key?: string;
  tip?: string[];
}

interface BarChartProps {
  data: ChartDatum[];
  /** altura del Ã¡rea de trazado en px */
  height?: number;
  /** escala del eje Y (la logarÃ­tmica es solo para distribuciones, rotulada por el llamador) */
  scale?: "linear" | "log";
  /** lÃ­nea de serie sobre las barras (media mÃ³vil / acumulado) */
  overlay?: { label: string; values: (number | null)[] } | null;
  /** lÃ­nea horizontal de referencia punteada (p. ej. baseline) */
  refLine?: { value: number; label: string } | null;
  selectedKey?: string | null;
  onBarClick?: (d: ChartDatum) => void;
  ariaLabel?: string;
  /** Ocupa toda la altura disponible del contenedor (vista ampliada) */
  fill?: boolean;
}

/* Escala "bonita": el eje nunca trunca la barra mÃ¡xima */
export function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 4, ticks: [0, 1, 2, 3, 4] };
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return { top, ticks };
}

export function logTicks(top: number): number[] {
  const ticks = [0];
  let v = 1;
  while (v <= top) {
    ticks.push(v);
    v *= 10;
  }
  if (ticks[ticks.length - 1] !== top && top > 0) ticks.push(top);
  return ticks;
}

function emptyMsg(height: number) {
  return (
    <div className="flex items-center justify-center text-xs text-content-muted" style={{ height }}>
      Sin datos para mostrar.
    </div>
  );
}

export default function BarChart({
  data,
  height: fixedHeight = 140,
  scale = "linear",
  overlay = null,
  refLine = null,
  selectedKey = null,
  onBarClick,
  ariaLabel,
  fill = false,
}: BarChartProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [autoH, setAutoH] = useState(0);

  /* Altura medida del área de trazado cuando el gráfico se estira (fill) */
  useEffect(() => {
    if (!fill) return;
    const el = plotRef.current;
    if (!el) return;
    const measure = () => setAutoH(Math.round(el.clientHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);

  const height = fill ? autoH || 320 : fixedHeight;
  if (!data.length || !data.some((d) => d.value > 0)) return emptyMsg(height);

  const overlayMax = overlay ? Math.max(...overlay.values.map((v) => v ?? 0)) : 0;
  const maxV = Math.max(...data.map((d) => d.value), overlayMax, refLine?.value ?? 0);
  const isLog = scale === "log";
  const { top, ticks: linTicks } = niceScale(maxV);
  const ticks = isLog ? logTicks(top) : linTicks;
  const logDen = Math.log1p(top) || 1;
  const toH = (v: number) => (isLog ? Math.log1p(v) / logDen : top ? v / top : 0) * height;

  const showValues = data.length <= 14;
  const hasSelection = selectedKey !== null;

  /* Segmentos de la polilÃ­nea del overlay (salta huecos null) */
  const overlayRuns: { xs: number[]; ys: number[] }[] = [];
  if (overlay) {
    let cur: { xs: number[]; ys: number[] } = { xs: [], ys: [] };
    overlay.values.forEach((v, i) => {
      if (v == null) {
        if (cur.xs.length > 1) overlayRuns.push(cur);
        cur = { xs: [], ys: [] };
        return;
      }
      cur.xs.push(((i + 0.5) / data.length) * 100);
      cur.ys.push((1 - toH(v) / height) * 100);
    });
    if (cur.xs.length > 1) overlayRuns.push(cur);
  }

  return (
    <div role="img" className={fill ? "h-full min-h-0 flex flex-col" : ""} aria-label={ariaLabel ?? "GrÃ¡fico de barras"}>
      <div className={fill ? "flex gap-2 flex-1 min-h-0" : "flex gap-2"}>
        {/* Eje Y */}
        <div className="relative w-8 shrink-0" style={fill ? undefined : { height }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 text-[10px] leading-none text-content-muted"
              style={{ bottom: `${toH(t) - 4}px` }}
            >
              {t}
            </span>
          ))}
        </div>

        {/* Trazado */}
        <div ref={plotRef} className="chart-plot relative flex-1 min-w-0 min-h-0" style={fill ? undefined : { height }}>
          {ticks.map((t) => (
            <div key={t} className="chart-grid-line absolute left-0 right-0 border-t" style={{ bottom: `${toH(t)}px` }} />
          ))}

          {/* Barras + valor + tooltip + overlay + refLine */}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((item, i) => {
              const barPx = Math.max(toH(item.value), 3);
              const dimmed = hasSelection && item.key !== selectedKey;
              return (
                <div
                  key={i}
                  className={`relative flex-1 h-full min-w-0 flex flex-col justify-end items-center group ${
                    onBarClick ? "cursor-pointer" : ""
                  } ${dimmed ? "opacity-40" : ""}`}
                  onClick={onBarClick ? () => onBarClick(item) : undefined}
                >
                  {showValues && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 text-[9px] font-semibold leading-none text-content-secondary"
                      style={{ bottom: `${barPx + 3}px` }}
                    >
                      {item.value}
                    </span>
                  )}
                  <div
                    className={`w-full max-w-[26px] bg-gradient-to-t from-accent-600 to-accent-400 rounded-t transition-all group-hover:from-accent-500 group-hover:to-accent-400 ${
                      hasSelection && item.key === selectedKey ? "ring-1 ring-accent-600" : ""
                    }`}
                    style={{ height: `${barPx}px` }}
                  />
                  {item.tip && item.tip.length > 0 && (
                    <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 z-30 mb-1 w-max max-w-[240px] bg-surface border border-border rounded-md shadow-lg px-2.5 py-1.5 text-[11px] text-content text-left pointer-events-none">
                      {item.tip.map((line, li) => (
                        <div key={li} className={li === 0 ? "font-semibold" : "text-content-secondary"}>
                          {line}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Overlay en SVG (coordenadas %, trazo sin distorsiÃ³n) */}
          {overlayRuns.length > 0 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {overlayRuns.map((run, ri) => (
                <polyline
                  key={ri}
                  points={run.xs.map((x, k) => `${x},${run.ys[k]}`).join(" ")}
                  fill="none"
                  stroke="var(--content)"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          )}

          {/* LÃ­nea de referencia */}
          {refLine && refLine.value <= top && (
            <div className="absolute left-0 right-0 pointer-events-none" style={{ bottom: `${toH(refLine.value)}px` }}>
              <div className="border-t-2 border-dashed border-content-muted" />
              <span className="absolute right-0 -top-4 text-[9px] font-medium text-content-muted bg-surface px-1 rounded">
                {refLine.label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Eje X */}
      <div className="flex gap-2 mt-1 shrink-0">
        <div className="w-8 shrink-0" />
        <div className="flex-1 min-w-0 flex gap-[2px]">
          {data.map((item, i) => (
            <span key={i} className="flex-1 min-w-0 text-center text-[9px] leading-tight text-content-muted truncate">
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Leyenda de overlay / referencia */}
      {(overlay || refLine) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 shrink-0 text-[10px] text-content-muted">
          {overlay && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t-2 border-dashed border-content" />
              {overlay.label}
            </span>
          )}
          {refLine && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t-2 border-dashed border-content-muted" />
              {refLine.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
