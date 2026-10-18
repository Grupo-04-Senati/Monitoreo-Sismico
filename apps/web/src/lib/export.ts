import type { SeismicEvent } from "@/types";
import { fmtDateTimeUTC5, fmtDateUTC5 } from "@/lib/format";
import { niceScale, logTicks } from "@/components/charts/BarChart";

/* ════ Descarga genérica ═══════════════════════════════ */
export function downloadFile(filename: string, data: string | Blob, mime = "application/octet-stream"): void {
  const blob = typeof data === "string" ? new Blob([data], { type: mime }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ════ CSV (BOM para Excel) ═══════════════════════════ */
function csvCell(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const EVENT_COLS = [
  "id",
  "id_externo",
  "fecha_utc",
  "fecha_utc5",
  "lugar",
  "magnitud",
  "tipo_magnitud",
  "profundidad_km",
  "region",
  "fuente",
  "estado",
];

export function exportEventsCsv(events: SeismicEvent[], filename = "eventos.csv"): void {
  const lines = [EVENT_COLS.join(";")];
  for (const e of events) {
    lines.push(
      [
        e.id,
        e.externalId,
        e.occurredAt,
        fmtDateTimeUTC5(e.occurredAt),
        e.place,
        e.magnitude.toFixed(1),
        e.magnitudeType,
        e.depthKm,
        e.region,
        e.sourceName,
        e.status,
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  downloadFile(filename, "\uFEFF" + lines.join("\r\n"), "text/csv;charset=utf-8");
}

/* ════ Colores resueltos del tema actual ══════════════ */
function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/* ════ PNG de un gráfico (canvas manual) ════ */
export type ChartKind = "vbar" | "hbar" | "area";

export function exportChartPng(
  data: { label: string; value: number }[],
  opts: {
    filename?: string;
    title?: string;
    scale?: "linear" | "log";
    scaleLabel?: string;
    /** tipo de gráfico a dibujar (debe coincidir con el de la pantalla) */
    kind?: ChartKind;
  } = {},
): void {
  const { filename = "grafico.png", title = "", scale = "linear", scaleLabel = "", kind = "vbar" } = opts;
  const isLog = scale === "log";

  const bg = cssVar("--surface", "#ffffff");
  const track = cssVar("--surface-tertiary", "#f1f5f9");
  const grid = cssVar("--border", "#e2e8f0");
  const txt = cssVar("--content", "#0f172a");
  const mut = cssVar("--content-muted", "#64748b");
  const bar = cssVar("--accent-600", "#0891b2");
  const barLight = cssVar("--accent-400", "#22d3ee");

  const n = data.length;
  const maxV = Math.max(...data.map((d) => d.value), 1);
  const { top: linTop, ticks: linTicks } = niceScale(maxV);
  const top = isLog ? Math.max(maxV, 1) : linTop;
  const ticks = isLog ? logTicks(top) : linTicks;
  const logDen = Math.log1p(top) || 1;
  const frac = (v: number) => (isLog ? Math.log1p(v) / logDen : top ? v / top : 0);

  const canvas = document.createElement("canvas");
  let bw: number;
  let bh: number;
  let pad: { l: number; r: number; t: number; b: number };
  if (kind === "hbar") {
    bw = 900;
    bh = Math.max(360, n * 56 + 104);
    pad = { l: 150, r: 80, t: 68, b: 40 };
  } else {
    bw = Math.max(720, Math.min(1800, n * (kind === "area" ? 42 : 46) + 88));
    bh = 560;
    pad = { l: 64, r: 24, t: 60, b: 76 };
  }
  canvas.width = bw * 2;
  canvas.height = bh * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(2, 2);

  const plotW = bw - pad.l - pad.r;
  const plotH = bh - pad.t - pad.b;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, bw, bh);

  if (title) {
    ctx.fillStyle = txt;
    ctx.font = "600 16px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(title, pad.l, 30);
  }
  if (scaleLabel) {
    ctx.fillStyle = mut;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(scaleLabel, bw - pad.r, 30);
  }

  ctx.font = "11px system-ui, sans-serif";

  if (kind === "hbar") {
    /* Barras horizontales con pista, valor al final y etiqueta a la izquierda */
    for (const t of ticks) {
      const x = pad.l + plotW * frac(t);
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, pad.t);
      ctx.lineTo(x + 0.5, pad.t + plotH);
      ctx.stroke();

      ctx.fillStyle = mut;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(String(t), x, pad.t + plotH + 8);
    }

    const rowH = plotH / Math.max(n, 1);
    const barH = Math.min(30, rowH * 0.58);
    data.forEach((d, i) => {
      const cy = pad.t + rowH * i + rowH / 2;
      const w = plotW * frac(d.value);

      ctx.fillStyle = track;
      ctx.fillRect(pad.l, cy - barH / 2, plotW, barH);

      const grad = ctx.createLinearGradient(pad.l, 0, pad.l + Math.max(w, 1), 0);
      grad.addColorStop(0, bar);
      grad.addColorStop(1, barLight);
      ctx.fillStyle = grad;
      ctx.fillRect(pad.l, cy - barH / 2, w, barH);

      ctx.fillStyle = txt;
      ctx.font = "600 12px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(d.label, pad.l - 12, cy);

      ctx.font = "600 11px system-ui, sans-serif";
      if (w >= 46) {
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "right";
        ctx.fillText(String(d.value), pad.l + w - 8, cy);
      } else {
        ctx.fillStyle = txt;
        ctx.textAlign = "left";
        ctx.fillText(String(d.value), pad.l + w + 8, cy);
      }
    });
  } else {
    /* Rejilla horizontal + eje Y (barras verticales y área) */
    for (const t of ticks) {
      const y = pad.t + plotH - frac(t) * plotH;
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y + 0.5);
      ctx.lineTo(bw - pad.r, y + 0.5);
      ctx.stroke();
      ctx.fillStyle = mut;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(String(t), pad.l - 8, y);
    }

    const slot = plotW / Math.max(n, 1);
    const px = (i: number) => pad.l + slot * (i + 0.5);
    const py = (v: number) => pad.t + plotH - frac(v) * plotH;
    const skipX = Math.ceil(n / 24);

    if (kind === "area") {
      ctx.beginPath();
      ctx.moveTo(px(0), pad.t + plotH);
      data.forEach((d, i) => ctx.lineTo(px(i), py(d.value)));
      ctx.lineTo(px(n - 1), pad.t + plotH);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, pad.t, 0, pad.t + plotH);
      g.addColorStop(0, barLight);
      g.addColorStop(1, bg);
      ctx.fillStyle = g;
      ctx.fill();

      ctx.strokeStyle = bar;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      data.forEach((d, i) => {
        if (i === 0) ctx.moveTo(px(i), py(d.value));
        else ctx.lineTo(px(i), py(d.value));
      });
      ctx.stroke();

      if (n <= 40) {
        ctx.fillStyle = bar;
        data.forEach((d, i) => {
          ctx.beginPath();
          ctx.arc(px(i), py(d.value), 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    } else {
      const barW = Math.max(6, Math.min(30, slot * 0.6));
      data.forEach((d, i) => {
        const x = pad.l + slot * i + (slot - barW) / 2;
        const y = py(d.value);
        const grad = ctx.createLinearGradient(0, y, 0, pad.t + plotH);
        grad.addColorStop(0, barLight);
        grad.addColorStop(1, bar);
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, pad.t + plotH - y);
      });
    }

    ctx.textBaseline = "alphabetic";
    data.forEach((d, i) => {
      if (kind !== "area" || n <= 14) {
        ctx.fillStyle = txt;
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(d.value), px(i), py(d.value) - 6);
      }
      if (i % skipX === 0 || n <= 24) {
        ctx.fillStyle = mut;
        ctx.font = "11px system-ui, sans-serif";
        ctx.fillText(d.label, px(i), pad.t + plotH + 18);
      }
    });
  }

  canvas.toBlob((blob) => {
    if (blob) downloadFile(filename, blob, "image/png");
  }, "image/png");
}

/* ════ CSV genérico de filas ya calculadas ═══════════ */
export function exportFilasCsv(
  columnas: string[],
  filas: (string | number)[][],
  filename = "datos.csv",
): void {
  const lines = [columnas.join(";")];
  for (const fila of filas) lines.push(fila.map(csvCell).join(";"));
  downloadFile(filename, "\uFEFF" + lines.join("\r\n"), "text/csv;charset=utf-8");
}

/* ════ PNG a partir de un <svg> en pantalla ═══════════
   Serializa el SVG resolviendo los colores del tema (variables CSS) a
   valores concretos para que la imagen exportada no dependa del DOM. */
export function exportSvgPng(
  svg: SVGSVGElement,
  filename = "grafico.png",
  opts: { scale?: number; background?: string } = {},
): void {
  const scale = opts.scale ?? 2;
  const rect = svg.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width || Number(svg.getAttribute("width")) || 1000));
  const h = Math.max(1, Math.round(rect.height || Number(svg.getAttribute("height")) || 600));
  const bg = opts.background ?? cssVar("--surface", "#ffffff");

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${w} ${h}`);

  const origNodes: Element[] = [svg, ...Array.from(svg.querySelectorAll("*"))];
  const cloneNodes: Element[] = [clone, ...Array.from(clone.querySelectorAll("*"))];
  const PROPS = [
    "fill", "fill-opacity", "stroke", "stroke-opacity", "stroke-width",
    "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity",
    "font-size", "font-family", "font-weight", "text-anchor",
    "stop-color", "stop-opacity",
  ];
  for (let i = 0; i < origNodes.length; i++) {
    const target = cloneNodes[i];
    if (!target) continue;
    const cs = getComputedStyle(origNodes[i]);
    for (const p of PROPS) {
      const v = cs.getPropertyValue(p).trim();
      if (v) target.setAttribute(p, v);
    }
  }

  const fondo = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  fondo.setAttribute("x", "0");
  fondo.setAttribute("y", "0");
  fondo.setAttribute("width", "100%");
  fondo.setAttribute("height", "100%");
  fondo.setAttribute("fill", bg);
  clone.insertBefore(fondo, clone.firstChild);

  const xml = new XMLSerializer().serializeToString(clone);
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (blob) downloadFile(filename, blob, "image/png");
    }, "image/png");
  };
  img.src = url;
}

/* ════ Copiar enlace con los filtros ══════════════════ */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export const csvDateName = (events: SeismicEvent[]): string => {
  if (!events.length) return "eventos.csv";
  const last = events.map((e) => e.occurredAt).sort().slice(-1)[0];
  return `eventos_${fmtDateUTC5(last)}.csv`.replace(/\s/g, "_");
};
