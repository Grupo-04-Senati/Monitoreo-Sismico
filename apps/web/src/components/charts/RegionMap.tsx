import { useMemo, useState } from "react";
import { DEPT_PATHS } from "@/components/background/deptPaths";
import type { ProvinceStat } from "@/lib/mock/provinces";

const VIEW_W = 18907.63;
const VIEW_H = 27437.79;

type Box = [number, number, number, number];

function unionBox(boxes: Box[]): Box | null {
  if (boxes.length === 0) return null;
  return boxes.reduce<Box>(
    (acc, b) => [
      Math.min(acc[0], b[0]),
      Math.min(acc[1], b[1]),
      Math.max(acc[2], b[2]),
      Math.max(acc[3], b[3]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}

function padBox(b: Box, factor: number): Box {
  const w = (b[2] - b[0]) * (1 + factor);
  const h = (b[3] - b[1]) * (1 + factor);
  const cx = (b[0] + b[2]) / 2;
  const cy = (b[1] + b[3]) / 2;
  return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
}

function viewFor(box: Box | null) {
  if (!box) return { k: 1, tx: 0, ty: 0 };
  const bw = Math.max(box[2] - box[0], 1);
  const bh = Math.max(box[3] - box[1], 1);
  const k = Math.min(VIEW_W / bw, VIEW_H / bh);
  const cx = (box[0] + box[2]) / 2;
  const cy = (box[1] + box[3]) / 2;
  return { k, tx: VIEW_W / 2 - k * cx, ty: VIEW_H / 2 - k * cy };
}

interface RegionMapProps {
  regionSlug?: string;
  regionName?: string;
  provinces?: ProvinceStat[];
  selProv?: string | null;
  onSelectProv?: (name: string) => void;
  onSelectRegion?: (slug: string) => void;
  onReset?: () => void;
  maxTotal?: number;
  /** Eventos por región para la vista previa del dashboard */
  regionCounts?: Record<string, number>;
  /** Vista previa: solo la capa base teñida por eventos, sin interacción ni marco */
  preview?: boolean;
}

export default function RegionMap({
  regionSlug = "",
  regionName = "",
  provinces = [],
  selProv = null,
  onSelectProv,
  onSelectRegion,
  onReset,
  maxTotal = 0,
  regionCounts,
  preview = false,
}: RegionMapProps) {
  const [hover, setHover] = useState<string | null>(null);
  const [hoverDept, setHoverDept] = useState<string | null>(null);

  const sel = provinces.find((p) => p.name === selProv) ?? null;
  const hoverStat = provinces.find((p) => p.name === hover) ?? null;
  const maxRegion = regionCounts ? Math.max(1, ...Object.values(regionCounts)) : 1;

  const { k, tx, ty } = useMemo(() => {
    const box = unionBox(provinces.map((p) => p.path.bbox));
    return viewFor(box ? padBox(box, 0.12) : null);
  }, [provinces]);

  const zoomed = k > 1.6;
  const labelSize = 11 / k;
  const maxN = Math.max(1, ...provinces.map((p) => p.n));

  const map = (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={
        preview
          ? "Mapa del Perú con la intensidad de eventos sísmicos por región."
          : regionSlug
            ? `Mapa de provincias de ${regionName}. ${provinces.length} provincias, ${maxTotal} eventos en el periodo.`
            : "Mapa de regiones del Perú con eventos sísmicos."
      }
    >
      <g
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${k})`,
          transformOrigin: "0 0",
          transition: "transform 380ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Capa base: departamentos como contexto */}
        <g>
          {Object.entries(DEPT_PATHS).map(([slug, dept]) => {
            const n = regionCounts?.[slug] ?? 0;
            const dim = regionSlug && slug !== regionSlug;
            const fill = regionCounts
              ? n > 0
                ? "var(--accent-500)"
                : "var(--map-land)"
              : "var(--map-land)";
            return (
              <path
                key={slug}
                d={dept.d}
                fill={fill}
                fillOpacity={
                  regionCounts
                    ? n > 0
                      ? 0.2 + 0.6 * (n / maxRegion)
                      : 1
                    : dim
                      ? 0.35
                      : 1
                }
                stroke="var(--border-strong)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                className={regionCounts ? "pointer-events-none" : "hover:brightness-95"}
                style={{ cursor: onSelectRegion ? "pointer" : "default" }}
                onMouseEnter={onSelectRegion ? () => setHoverDept(dept.name) : undefined}
                onMouseLeave={onSelectRegion ? () => setHoverDept((h) => (h === dept.name ? null : h)) : undefined}
                onClick={onSelectRegion ? () => onSelectRegion(slug) : undefined}
              />
            );
          })}
        </g>

        {/* Provincias de la región seleccionada */}
        {provinces.map((p) => {
          const ratio = p.n / maxN;
          const isSel = sel?.name === p.name;
          const isHover = hover === p.name;
          const fill = p.n === 0 ? "var(--map-empty)" : "var(--accent-500)";
          return (
            <path
              key={p.name}
              d={p.path.d}
              fill={isSel ? "var(--accent-600)" : fill}
              fillOpacity={isSel ? 0.9 : p.n === 0 ? 1 : 0.18 + 0.55 * ratio + (isHover ? 0.12 : 0)}
              stroke={isSel || isHover ? "var(--accent-600)" : "var(--border)"}
              strokeWidth={isSel || isHover ? 2 : 1}
              vectorEffect="non-scaling-stroke"
              style={{ cursor: "pointer", transition: "fill-opacity 150ms ease" }}
              onMouseEnter={() => setHover(p.name)}
              onMouseLeave={() => setHover((h) => (h === p.name ? null : h))}
              onClick={() => onSelectProv?.(p.name)}
            />
          );
        })}

        {/* Etiquetas de provincia (escala con el zoom) */}
        {zoomed &&
          provinces.map((p) => {
            const w = (p.path.bbox[2] - p.path.bbox[0]) * k;
            if (!sel && w < 42 && p.name !== hover) return null;
            const cx = (p.path.bbox[0] + p.path.bbox[2]) / 2;
            const cy = (p.path.bbox[1] + p.path.bbox[3]) / 2;
            return (
              <text
                key={`lbl-${p.name}`}
                x={cx}
                y={cy + 14 / k}
                fontSize={labelSize}
                textAnchor="middle"
                className="pointer-events-none select-none"
                fill={sel?.name === p.name ? "#ffffff" : "var(--content-secondary)"}
                style={{ fontWeight: 600, paintOrder: "stroke" }}
                stroke="var(--surface)"
                strokeWidth={2.5 / k}
              >
                {p.name}
              </text>
            );
          })}

        {/* Puntos de ubicación: al hacer clic se muestran las zonas afectadas */}
        {provinces
          .filter((p) => p.n > 0)
          .map((p) => {
            const cx = (p.path.bbox[0] + p.path.bbox[2]) / 2;
            const cy = (p.path.bbox[1] + p.path.bbox[3]) / 2;
            const isSel = sel?.name === p.name;
            const isHover = hover === p.name;
            const r = (isSel ? 7.5 : isHover ? 6.5 : 5.5) / k;
            return (
              <g
                key={`dot-${p.name}`}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHover(p.name)}
                onMouseLeave={() => setHover((h) => (h === p.name ? null : h))}
                onClick={() => onSelectProv?.(p.name)}
              >
                {(isSel || isHover) && (
                  <circle cx={cx} cy={cy} r={(r * 1.9) / 1} fill="var(--danger)" fillOpacity={0.22} />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r * 2.4}
                  fill="transparent"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="var(--danger)"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
      </g>
    </svg>
  );

  if (preview) {
    return <div className="chart-plot relative w-full h-full rounded-lg overflow-hidden">{map}</div>;
  }

  return (
    <section className="bg-surface border border-border rounded-lg flex flex-col overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface-secondary">
        <span className="text-xs font-semibold text-content shrink-0">
          {regionSlug ? `Provincias de ${regionName}` : "Mapa del Perú"}
        </span>
        <span className="text-[11px] text-content-muted truncate">
          {hoverStat
            ? `${hoverStat.name} · ${hoverStat.n} eventos · mag. máx. ${hoverStat.mx ? hoverStat.mx.toFixed(1) : "—"}`
            : hoverDept && hoverDept !== regionName
              ? `${hoverDept} · clic para ver sus provincias`
              : regionSlug
                ? "Clic en un punto rojo o en una provincia para ver las zonas afectadas"
                : `Clic en una región para ver sus provincias y ubicaciones · ${maxTotal} eventos`}
        </span>
        {regionSlug && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="ml-auto shrink-0 px-2 py-1 text-[11px] border border-border rounded-md text-content-secondary hover:bg-surface transition-colors"
          >
            Todo el Perú
          </button>
        )}
      </header>

      <div className="chart-plot relative flex-1 min-h-[300px] rounded-lg overflow-hidden">{map}</div>

      <footer className="flex items-center gap-3 px-3 py-1.5 border-t border-border bg-surface-secondary text-[11px] text-content-muted flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full border border-white" style={{ background: "var(--danger)" }} />
          Ubicación con eventos (clic)
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-3.5 h-2.5 rounded-sm border border-border"
            style={{ background: "var(--map-empty)" }}
          />
          Sin eventos
        </span>
        <span className="ml-auto">Geometrías: IGN · 197 provincias</span>
      </footer>
    </section>
  );
}
