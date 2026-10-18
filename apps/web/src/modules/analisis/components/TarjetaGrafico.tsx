import { useRef, useState, type ReactNode } from "react";
import { IconBarChart, IconDownload, IconExpand, IconInfo, IconReport } from "@/components/ui/Icons";
import { exportFilasCsv, exportSvgPng } from "@/lib/export";
import { slugify } from "@/lib/format";
import type { Columna } from "../types";
import TablaDatos from "./TablaDatos";

interface CsvData {
  columnas: string[];
  filas: (string | number)[][];
}

interface TablaInline {
  columnas: Columna[];
  filas: (string | number)[][];
}

interface TarjetaGraficoProps {
  titulo: string;
  subtitulo: string;
  info?: string;
  /** Nombre base del archivo PNG (sin extensión). Si se indica, se muestra "PNG". */
  png?: string;
  csv?: CsvData;
  /** Datos del gráfico para la tabla en línea (botón "Tabla"). */
  tabla?: TablaInline;
  meta?: string;
  ancho?: boolean;
  /** Controles propios del gráfico (van dentro de la tarjeta, sobre el gráfico). */
  controles?: ReactNode;
  onAmpliar?: () => void;
  children: ReactNode;
}

const botonIcono =
  "inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-content-secondary transition-colors hover:bg-surface-tertiary";

/**
 * Tarjeta de gráfico con su BARRA SUPERIOR: consolida en un solo sitio el
 * título, la ayuda ("info"), la tabla en línea, "Ampliar", "PNG" y "CSV", en
 * vez de repartir acciones por el pie. Así la información queda en un único
 * lugar y el gráfico nunca crece más de lo necesario.
 */
export default function TarjetaGrafico({
  titulo,
  subtitulo,
  info,
  png,
  csv,
  tabla,
  meta,
  ancho,
  controles,
  onAmpliar,
  children,
}: TarjetaGraficoProps) {
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const [verInfo, setVerInfo] = useState(false);
  const [verTabla, setVerTabla] = useState(false);
  const base = slugify(png ?? titulo) || "grafico";

  const exportarPng = () => {
    const svg = cuerpoRef.current?.querySelector("svg");
    if (svg) exportSvgPng(svg as SVGSVGElement, `${base}.png`, { scale: 2 });
  };

  return (
    <section
      className={`auth-surface tilt flex min-w-0 flex-col rounded-[10px] border border-border bg-surface transition-all hover:-translate-y-0.5 hover:border-accent-500 hover:shadow-md ${
        ancho ? "col-span-full" : ""
      }`}
    >
      {/* Barra superior de la tarjeta */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-3.5 py-2.5">
        <div className="min-w-0">
          <b className="text-sm font-semibold text-content">{titulo}</b>
          <p className="text-[11px] text-content-muted">{subtitulo}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {info && (
            <button
              type="button"
              onClick={() => setVerInfo((v) => !v)}
              className={`rounded-md p-1.5 transition-colors ${verInfo ? "bg-accent-600 text-white" : "text-content-muted hover:bg-surface-tertiary hover:text-content"}`}
              aria-label="Qué muestra este gráfico"
              aria-pressed={verInfo}
              title="Qué muestra"
            >
              <IconInfo size={14} />
            </button>
          )}
          {tabla && (
            <button
              type="button"
              onClick={() => setVerTabla((v) => !v)}
              className={`rounded-md p-1.5 transition-colors ${verTabla ? "bg-accent-600 text-white" : "text-content-muted hover:bg-surface-tertiary hover:text-content"}`}
              aria-label="Ver la tabla de datos del gráfico"
              aria-pressed={verTabla}
              title="Tabla de datos"
            >
              <IconBarChart size={14} />
            </button>
          )}
          {onAmpliar && (
            <button type="button" onClick={onAmpliar} className={botonIcono} title="Vista ampliada">
              <IconExpand size={13} />
              Ampliar
            </button>
          )}
          {png && (
            <button type="button" onClick={exportarPng} className={botonIcono} title="Descargar PNG del gráfico">
              <IconDownload size={13} />
              PNG
            </button>
          )}
          {csv && (
            <button
              type="button"
              onClick={() => exportFilasCsv(csv.columnas, csv.filas, `${base}.csv`)}
              className={botonIcono}
              title="Descargar CSV de los datos"
            >
              <IconReport size={13} />
              CSV
            </button>
          )}
        </div>
      </div>

      {info && verInfo && (
        <p className="border-b border-border bg-surface-tertiary px-3.5 py-2 text-[11px] text-content-secondary">
          {info}
        </p>
      )}

      {controles && (
        <div className="border-b border-border bg-surface-secondary px-3.5 py-2">{controles}</div>
      )}

      <div ref={cuerpoRef} className="min-w-0 flex-1 px-3 py-2">
        {children}
      </div>

      {tabla && verTabla && (
        <div className="border-t border-border px-3 py-2">
          <TablaDatos columnas={tabla.columnas} filas={tabla.filas.slice(0, 8)} maxAltura="max-h-[220px]" />
          {tabla.filas.length > 8 && (
            <p className="mt-1 text-[11px] text-content-muted">
              Mostrando 8 de {tabla.filas.length.toLocaleString("es-PE")} filas · usa “Ampliar” para verlas todas.
            </p>
          )}
        </div>
      )}

      {meta && (
        <p className="border-t border-border px-3.5 py-1.5 text-[11px] text-content-muted">{meta}</p>
      )}
    </section>
  );
}
