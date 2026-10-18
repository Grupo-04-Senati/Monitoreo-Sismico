import { useEffect, useRef, useState } from "react";
import { niceScale } from "@/components/charts/BarChart";
import type { EstadoEjecucion } from "../types";

export interface PuntoLatencia {
  label: string;
  value: number;
  estado: EstadoEjecucion;
  tip: string[];
}

const COLOR: Record<EstadoEjecucion, string> = {
  correcta: "var(--accent-500)",
  con_errores: "var(--warning)",
  fallida: "var(--danger)",
  en_curso: "var(--accent-400)",
};

const LEYENDA: { estado: EstadoEjecucion; label: string }[] = [
  { estado: "correcta", label: "Correcta" },
  { estado: "con_errores", label: "Con errores" },
  { estado: "fallida", label: "Fallida" },
  { estado: "en_curso", label: "En curso" },
];

interface GraficoLatenciaProps {
  data: PuntoLatencia[];
  height?: number;
  /** Ocupa toda la altura disponible del contenedor (vista ampliada). */
  fill?: boolean;
  onPuntoClick?: (index: number) => void;
}

/**
 * Latencia por ejecución. La escala se calcula con las ejecuciones que
 * respondieron; las fallidas se fijan arriba (timeout) y se dibujan en rojo
 * para que el eje no quede dominado por el valor atípico.
 */
export default function GraficoLatencia({ data, height = 180, fill = false, onPuntoClick }: GraficoLatenciaProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [autoH, setAutoH] = useState(0);

  /* Altura medida cuando el gráfico se estira (vista ampliada) */
  useEffect(() => {
    if (!fill) return;
    const el = rowRef.current;
    if (!el) return;
    const measure = () => setAutoH(Math.round(el.clientHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);

  const alto = fill ? autoH || 320 : height;

  if (!data.length) {
    return (
      <div className={`flex items-center justify-center text-xs text-content-muted ${fill ? "h-full" : ""}`} style={fill ? undefined : { height }}>
        Sin ejecuciones para mostrar.
      </div>
    );
  }

  const sanos = data.filter((d) => d.estado !== "fallida").map((d) => d.value);
  const maxSano = sanos.length ? Math.max(...sanos) : Math.max(...data.map((d) => d.value), 1);
  const { top, ticks } = niceScale(maxSano);
  const n = data.length;

  const fx = (i: number) => ((i + 0.5) / n) * 100;
  const fy = (v: number) => (top ? Math.min(v / top, 1) * 100 : 0);

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
  const paso = n > 16 ? Math.ceil(n / 8) : 1;

  return (
    <div role="img" aria-label="Latencia por ejecución de la ingesta" className={fill ? "h-full min-h-0 flex flex-col" : ""}>
      <div ref={rowRef} className={fill ? "flex gap-2 flex-1 min-h-0" : "flex gap-2"} style={fill ? undefined : { height: alto }}>
        <div className="relative w-10 shrink-0">
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

        <div className="chart-plot relative flex-1 min-w-0 min-h-0">
          {ticks.map((t) => (
            <div key={t} className="chart-grid-line absolute left-0 right-0 border-t" style={{ bottom: `${fy(t)}%` }} />
          ))}

          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d={area} fill="var(--accent-500)" fillOpacity="0.12" />
            <path d={line} fill="none" stroke="var(--accent-500)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          <div className="absolute inset-0 flex">
            {data.map((d, i) => {
              const yPct = fy(d.value);
              const abajo = yPct > 68;
              return (
                <div
                  key={i}
                  className={`group relative min-w-0 flex-1 ${onPuntoClick ? "cursor-pointer" : ""}`}
                  onClick={onPuntoClick ? () => onPuntoClick(i) : undefined}
                >
                  <span
                    className="absolute left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full ring-1 ring-[var(--chart-bg)]"
                    style={{ bottom: `${yPct}%`, background: COLOR[d.estado] }}
                  />
                  {d.tip.length > 0 && (
                    <div
                      className="pointer-events-none absolute left-1/2 z-30 hidden w-max max-w-[240px] -translate-x-1/2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-left text-[11px] text-content shadow-lg group-hover:block"
                      style={abajo ? { top: `calc(${100 - yPct}% + 10px)` } : { bottom: `calc(${yPct}% + 10px)` }}
                    >
                      {d.tip.map((t, ti) => (
                        <div key={ti} className={ti === 0 ? "font-semibold" : "text-content-secondary"}>
                          {t}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Eje X */}
      <div className="mt-1 flex gap-2 shrink-0">
        <div className="w-10 shrink-0" />
        <div className="flex min-w-0 flex-1">
          {data.map((d, i) => (
            <span key={i} className="min-w-0 flex-1 truncate text-center text-[9px] leading-tight text-content-muted">
              {i % paso === 0 ? d.label : ""}
            </span>
          ))}
        </div>
      </div>

      {/* Leyenda */}
      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-content-muted shrink-0">
        {LEYENDA.map((l) => (
          <li key={l.estado} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR[l.estado] }} aria-hidden="true" />
            {l.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
