import { niceScale } from "@/components/charts/BarChart";

interface GraficoRealEstimadoProps {
  serie: Record<string, string | number>[];
  /** Columna del eje X (p. ej. "semana"); sin ella se usa el orden. */
  ejeX?: string;
  /** Modelo cuya estimación se dibuja frente al valor real. */
  modelo: string;
  etiquetaModelo: string;
  unidad: string;
}

const ALTO = 220;

/**
 * Curva real frente a estimada en la partición de prueba (PDF §6.6). El eje Y
 * empieza en 0 para no exagerar diferencias (PDF §11: sin ejes truncados).
 */
export default function GraficoRealEstimado({ serie, ejeX, modelo, etiquetaModelo, unidad }: GraficoRealEstimadoProps) {
  const reales = serie.map((p) => Number(p.real));
  const estimados = serie.map((p) => Number(p[modelo]));
  if (serie.length < 2 || estimados.some((v) => Number.isNaN(v))) {
    return <p className="py-6 text-center text-xs text-content-muted">Sin serie de prueba para mostrar.</p>;
  }

  const minimo = Math.min(0, ...reales, ...estimados);
  const { top, ticks } = niceScale(Math.max(...reales, ...estimados, 1));
  const n = serie.length;
  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => 100 - ((v - minimo) / (top - minimo || 1)) * 100;
  const linea = (valores: number[]) => valores.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const primera = ejeX ? String(serie[0][ejeX]) : "1";
  const ultima = ejeX ? String(serie[n - 1][ejeX]) : String(n);

  return (
    <figure>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-right text-[10px] text-content-muted" style={{ height: ALTO }} aria-hidden="true">
          {[...ticks].reverse().map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full overflow-visible rounded border border-border bg-surface"
          style={{ height: ALTO }}
          role="img"
          aria-label={`Valor real frente a ${etiquetaModelo} en ${n} puntos de prueba`}
        >
          {ticks.map((t) => (
            <line key={t} x1="0" x2="100" y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={linea(reales)} fill="none" className="stroke-slate-400" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={linea(estimados)} fill="none" className="stroke-accent-600" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-1 flex justify-between pl-8 text-[10px] text-content-muted">
        <span>{primera}</span>
        <span>{ultima}</span>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-content-secondary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-slate-400" aria-hidden="true" /> Real ({unidad})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1 w-4 bg-accent-600" aria-hidden="true" /> {etiquetaModelo}
        </span>
        <span className="text-content-muted">Partición de prueba · n = {n}</span>
      </figcaption>
    </figure>
  );
}
