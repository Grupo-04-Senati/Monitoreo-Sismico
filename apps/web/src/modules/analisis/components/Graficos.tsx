import { useState } from "react";
import { niceScale } from "@/components/charts/BarChart";
import { rangoConMargen } from "../lib/estadistica";
import { useAncho } from "../lib/useAncho";
import type { IdGrafico, PuntoDispersion, PuntoGrafico, ResultadoAnalisis } from "../types";

/* ════════════════════════════════════════════════════════════════
   Gráficos SVG del módulo de Análisis estadístico.
   Son SVG nativos (no divs) para poder exportarse a PNG con
   `exportSvgPng` y para admitir clic en barras y puntos.
   Los colores usan las variables del tema; la exportación las
   resuelve a valores concretos.
   El ancho del `viewBox` se ajusta al ancho real del contenedor para
   que el gráfico APROVECHE el espacio disponible sin estirar el texto
   (la escala se mantiene uniforme y la altura queda acotada).
   El detalle al pasar el cursor se muestra en un tooltip HTML
   ABSOLUTO (no desplaza el contenido), como en el Dashboard.
   ════════════════════════════════════════════════════════════════ */

interface Tip {
  x: number;
  y: number;
  lines: string[];
}

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-30 w-max max-w-[240px] -translate-x-1/2 -translate-y-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-left text-[11px] text-content shadow-lg"
      style={{ left: `${tip.x}%`, top: `${tip.y}%` }}
    >
      {tip.lines.map((l, i) => (
        <div key={i} className={i === 0 ? "font-semibold" : "text-content-secondary"}>
          {l}
        </div>
      ))}
    </div>
  );
}

function Vacio({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex h-40 items-center justify-center text-xs text-content-muted">{mensaje}</div>
  );
}

const sinDatos = (p: { value: number }[]) => !p.length || !p.some((x) => x.value > 0);

const MIN_W = 700;
const MAX_W = 1600;

/** Ancho del viewBox: sigue el ancho real del contenedor, acotado a un rango. */
function anchoViewBox(ancho: number, s: number, min = MIN_W, max = MAX_W): number {
  if (!ancho) return 1000;
  return Math.min(max, Math.max(min, Math.round(ancho / s)));
}

const estiloSvg = (w: number, s: number) => ({
  width: "100%",
  maxWidth: `${Math.round(w * s)}px`,
  margin: "0 auto",
  display: "block",
});

/* ── Barras verticales ────────────────────────────────── */

interface BarrasProps {
  puntos: PuntoGrafico[];
  overlay?: (number | null)[] | null;
  overlayLabel?: string;
  ariaLabel: string;
  /** Altura en px del SVG (por defecto, tamaño de tarjeta). */
  height?: number;
  onBarClick?: (p: PuntoGrafico, i: number) => void;
}

export function GraficoBarras({ puntos, overlay, overlayLabel, ariaLabel, height = 210, onBarClick }: BarrasProps) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (sinDatos(puntos)) return <Vacio mensaje="Sin datos para estos filtros." />;

  const H = 360;
  const s = height / H;
  const W = anchoViewBox(ancho, s);
  const L = 72;
  const R = 20;
  const T = 34;
  const B = 64;
  const plotW = W - L - R;
  const plotH = H - T - B;

  const overlayMax = overlay ? Math.max(...overlay.map((v) => v ?? 0)) : 0;
  const maxV = Math.max(...puntos.map((p) => p.value), overlayMax, 1);
  const { top, ticks } = niceScale(maxV);
  const toY = (v: number) => T + plotH - (top ? v / top : 0) * plotH;

  const n = puntos.length;
  const slot = plotW / n;
  const bumpPx = n <= 8 ? 90 : 46;
  const bw = Math.max(2, Math.min(slot * 0.62, bumpPx / s));
  const slotPx = slot * s;
  const saltar = Math.max(1, Math.ceil(46 / Math.max(slotPx, 1)));
  const mostrarValor = n <= 14;

  const abrirTip = (p: PuntoGrafico, i: number) =>
    setTip({
      x: ((L + slot * (i + 0.5)) / W) * 100,
      y: (toY(p.value) / H) * 100,
      lines: [`${p.label}`, `${p.value} eventos`],
    });

  return (
    <div ref={ref} className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        height={height}
        preserveAspectRatio="xMidYMid meet"
        style={estiloSvg(W, s)}
        role="img"
        aria-label={ariaLabel}
      >
        {ticks.map((t) => {
          const y = toY(t);
          return (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
              <text x={L - 10} y={y + 6} textAnchor="end" fontSize={20} fill="var(--content-muted)">
                {t}
              </text>
            </g>
          );
        })}

        <line x1={L} x2={W - R} y1={toY(0)} y2={toY(0)} stroke="var(--border)" strokeWidth={1.5} />

        {puntos.map((p, i) => {
          const x = L + slot * i + (slot - bw) / 2;
          const y = toY(p.value);
          const h = Math.max(toY(0) - y, 2);
          return (
            <g
              key={i}
              className={onBarClick ? "cursor-pointer" : undefined}
              onMouseEnter={() => {
                setHover(i);
                abrirTip(p, i);
              }}
              onMouseLeave={() => {
                setHover(null);
                setTip(null);
              }}
              onClick={onBarClick ? () => onBarClick(p, i) : undefined}
            >
              <rect
                x={x}
                y={y}
                width={bw}
                height={h}
                rx={2}
                fill={hover === i ? "var(--accent-400)" : "var(--accent-500)"}
                opacity={hover == null || hover === i ? 0.95 : 0.75}
                style={{ transition: "fill 150ms ease, opacity 150ms ease" }}
              >
                <title>{`${p.label}: ${p.value} eventos · ver detalle`}</title>
              </rect>
              {mostrarValor && (
                <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize={20} fontWeight={600} fill="var(--content)">
                  {p.value}
                </text>
              )}
              {i % saltar === 0 && (
                <text x={L + slot * (i + 0.5)} y={H - 24} textAnchor="middle" fontSize={18} fill="var(--content-muted)">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}

        {overlay && overlay.some((v) => v != null) && (
          <polyline
            fill="none"
            stroke="var(--content)"
            strokeWidth={2}
            strokeDasharray="6 4"
            points={overlay
              .map((v, i) => (v == null ? null : `${L + slot * (i + 0.5)},${toY(v)}`))
              .filter(Boolean)
              .join(" ")}
          />
        )}

        {overlay && overlayLabel && (
          <g>
            <line
              x1={L}
              x2={L + 30}
              y1={T - 17}
              y2={T - 17}
              stroke="var(--content)"
              strokeWidth={2.5}
              strokeDasharray="6 4"
            />
            <text x={L + 38} y={T - 12} fontSize={18} fill="var(--content-muted)">
              {overlayLabel}
            </text>
          </g>
        )}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ── Barras horizontales ──────────────────────────────── */

interface BarrasHProps {
  puntos: PuntoGrafico[];
  ariaLabel: string;
  /** Altura máxima visible en px; el resto hace scroll. */
  maxAlto?: number;
  onBarClick?: (p: PuntoGrafico, i: number) => void;
}

export function GraficoBarrasH({ puntos, ariaLabel, maxAlto = 240, onBarClick }: BarrasHProps) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (sinDatos(puntos)) return <Vacio mensaje="Sin datos para estos filtros." />;

  const rh = 46;
  const filaPx = 34;
  const s = filaPx / rh;
  const H = puntos.length * rh + 24;
  const W = anchoViewBox(ancho, s, 600, 2400);
  const L = 250;
  const R = 90;
  const plotW = W - L - R;
  const maxV = Math.max(...puntos.map((p) => p.value), 1);
  const total = puntos.reduce((acc, p) => acc + p.value, 0) || 1;

  return (
    <div ref={ref} className="relative w-full overflow-y-auto" style={{ maxHeight: maxAlto }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={estiloSvg(W, s)} role="img" aria-label={ariaLabel}>
        {puntos.map((p, i) => {
          const y = 12 + i * rh;
          const w = plotW * (p.value / maxV);
          const bh = rh - 12;
          return (
            <g
              key={i}
              className={onBarClick ? "cursor-pointer" : undefined}
              onMouseEnter={() => {
                setHover(i);
                setTip({
                  x: ((L + Math.max(w, 1)) / W) * 100,
                  y: ((y + bh / 2) / H) * 100,
                  lines: [p.label, `${p.value} eventos (${((p.value / total) * 100).toFixed(1)}%)`],
                });
              }}
              onMouseLeave={() => {
                setHover(null);
                setTip(null);
              }}
              onClick={onBarClick ? () => onBarClick(p, i) : undefined}
            >
              <text x={L - 12} y={y + bh * 0.7} textAnchor="end" fontSize={20} fill="var(--content)">
                {p.label}
              </text>
              <rect x={L} y={y} width={plotW} height={bh} rx={2} fill="var(--surface-tertiary)" />
              <rect
                x={L}
                y={y}
                width={Math.max(w, 1)}
                height={bh}
                rx={2}
                fill={hover === i ? "var(--accent-400)" : "var(--accent-500)"}
                style={{ transition: "fill 150ms ease" }}
              >
                <title>{`${p.label}: ${p.value} eventos (${((p.value / total) * 100).toFixed(1)}%) · ver detalle`}</title>
              </rect>
              <text x={L + Math.max(w, 1) + 10} y={y + bh * 0.7} fontSize={20} fontWeight={600} fill="var(--content)">
                {p.value}
              </text>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ── Dispersión ───────────────────────────────────────── */

interface DispersionProps {
  puntos: PuntoDispersion[];
  xLabel: string;
  yLabel: string;
  ariaLabel: string;
  height?: number;
  onPointClick?: (p: PuntoDispersion, i: number) => void;
}

export function GraficoDispersion({ puntos, xLabel, yLabel, ariaLabel, height = 250, onPointClick }: DispersionProps) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (!puntos.length) return <Vacio mensaje="Sin eventos con ambas variables para estos filtros." />;

  const H = 460;
  const s = height / H;
  const W = anchoViewBox(ancho, s);
  const L = 90;
  const R = 40;
  const T = 30;
  const B = 72;
  const plotW = W - L - R;
  const plotH = H - T - B;

  const [x0, x1] = rangoConMargen(puntos.map((p) => p.x));
  const [y0, y1] = rangoConMargen(puntos.map((p) => p.y));
  const sx = (v: number) => L + plotW * ((v - x0) / (x1 - x0));
  const sy = (v: number) => T + plotH * (1 - (v - y0) / (y1 - y0));
  const rPunto = Math.max(4, 5 / s);

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div ref={ref} className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        height={height}
        preserveAspectRatio="xMidYMid meet"
        style={estiloSvg(W, s)}
        role="img"
        aria-label={ariaLabel}
      >
        {ticks.map((f) => {
          const xv = x0 + (x1 - x0) * f;
          const yv = y0 + (y1 - y0) * f;
          return (
            <g key={f}>
              <line x1={L} x2={W - R} y1={sy(yv)} y2={sy(yv)} stroke="var(--border)" strokeWidth={1} />
              <line x1={sx(xv)} x2={sx(xv)} y1={T} y2={T + plotH} stroke="var(--border)" strokeWidth={1} />
              <text x={L - 10} y={sy(yv) + 6} textAnchor="end" fontSize={18} fill="var(--content-muted)">
                {yv.toFixed(1)}
              </text>
              <text x={sx(xv)} y={T + plotH + 26} textAnchor="middle" fontSize={18} fill="var(--content-muted)">
                {xv.toFixed(1)}
              </text>
            </g>
          );
        })}

        <text x={L + plotW / 2} y={H - 10} textAnchor="middle" fontSize={20} fill="var(--content)">
          X: {xLabel}
        </text>
        <text x={L} y={18} fontSize={20} fill="var(--content)">
          Y: {yLabel}
        </text>

        {puntos.map((p, i) => (
          <circle
            key={i}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={hover === i ? rPunto * 1.6 : rPunto}
            fill="var(--accent-500)"
            fillOpacity={hover === i ? 0.95 : 0.6}
            className={onPointClick ? "cursor-pointer" : undefined}
            style={{ transition: "r 120ms ease, fill-opacity 120ms ease" }}
            onMouseEnter={() => {
              setHover(i);
              setTip({
                x: (sx(p.x) / W) * 100,
                y: (sy(p.y) / H) * 100,
                lines: [p.evento.id, `${xLabel}: ${p.x}`, `${yLabel}: ${p.y}`],
              });
            }}
            onMouseLeave={() => {
              setHover(null);
              setTip(null);
            }}
            onClick={onPointClick ? () => onPointClick(p, i) : undefined}
          >
            <title>{`${p.evento.id} · X ${p.x} · Y ${p.y}`}</title>
          </circle>
        ))}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

/* ── Selector de gráfico por id ───────────────────────── */

interface ResultadoProps {
  id: IdGrafico;
  resultado: ResultadoAnalisis;
  /** Altura de los gráficos de barras/dispersión (barras H usan maxAlto). */
  height?: number;
  maxAlto?: number;
  onBarClick?: (p: PuntoGrafico, i: number) => void;
  onPointClick?: (p: PuntoDispersion, i: number) => void;
}

/** Renderiza el gráfico correspondiente a una tarjeta a partir del resultado. */
export function GraficoResultado({ id, resultado, height, maxAlto, onBarClick, onPointClick }: ResultadoProps) {
  const r = resultado;
  switch (id) {
    case "ts":
      return (
        <GraficoBarras
          puntos={r.serie.puntos}
          overlay={r.serie.mediaMovil}
          overlayLabel={r.serie.nota ? "Media móvil 7 d" : undefined}
          ariaLabel="Serie temporal de eventos"
          height={height}
          onBarClick={onBarClick}
        />
      );
    case "mh":
      return (
        <GraficoBarras
          puntos={r.magnitudes.puntos}
          ariaLabel="Histograma de magnitud"
          height={height}
          onBarClick={onBarClick}
        />
      );
    case "dh":
      return (
        <GraficoBarras
          puntos={r.profundidades.puntos}
          ariaLabel="Distribución de profundidad"
          height={height}
          onBarClick={onBarClick}
        />
      );
    case "rg":
      return (
        <GraficoBarrasH
          puntos={r.regiones.puntos}
          ariaLabel="Conteo por región"
          maxAlto={maxAlto}
          onBarClick={onBarClick}
        />
      );
    case "sc":
      return (
        <GraficoDispersion
          puntos={r.dispersion.puntos}
          xLabel={r.dispersion.xLabel}
          yLabel={r.dispersion.yLabel}
          ariaLabel="Dispersión X vs Y"
          height={height}
          onPointClick={onPointClick}
        />
      );
    default:
      return null;
  }
}
