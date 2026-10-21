import type { SemanaEntrada } from "../types";
import { fmtValor } from "../schemas/estimaciones.schema";

interface GraficoEntradasProps {
  semanas: SemanaEntrada[];
  valor: number;
  inferior: number;
  superior: number;
  inicioVentana: string;
}

const ALTO = 160;

function etiquetaSemana(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(iso));
}

/**
 * Las semanas observadas que usó el modelo (gris) y, al final, la estimación
 * (violeta, con su intervalo). Colores distintos para no confundir lo observado
 * con lo estimado (PDF §6.7). Eje desde 0.
 */
export default function GraficoEntradas({ semanas, valor, inferior, superior, inicioVentana }: GraficoEntradasProps) {
  if (semanas.length === 0) return <p className="text-xs text-content-muted">Sin semanas de entrada.</p>;
  const maximo = Math.max(superior, ...semanas.map((s) => s.conteo), 1) * 1.1;
  const alto = (v: number) => `${(v / maximo) * 100}%`;

  return (
    <figure>
      <div className="flex items-end gap-1" style={{ height: ALTO }} role="img" aria-label={`Semanas observadas usadas como entrada y estimación ${fmtValor(valor)}`}>
        {semanas.map((s) => (
          <div key={s.inicio} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`Semana del ${etiquetaSemana(s.inicio)}: ${s.conteo} sismos (observado)`}>
            <span className="mb-0.5 text-center text-[9px] text-content-muted">{s.conteo}</span>
            <div className="rounded-t bg-slate-400 dark:bg-slate-500" style={{ height: alto(s.conteo), minHeight: s.conteo ? 2 : 0 }} />
          </div>
        ))}
        <div className="relative flex h-full min-w-0 flex-[1.4] flex-col justify-end border-l border-dashed border-border pl-1" title={`Estimación: ${fmtValor(valor)} (intervalo ${fmtValor(inferior)}–${fmtValor(superior)})`}>
          {/* Bigote del intervalo */}
          <div
            className="absolute left-1/2 w-0 -translate-x-1/2 border-l-2 border-purple-400"
            style={{ bottom: alto(inferior), height: `calc(${alto(superior)} - ${alto(inferior)})` }}
          />
          <span className="relative mb-0.5 text-center text-[9px] font-semibold text-purple-700 dark:text-purple-300">{fmtValor(valor)}</span>
          <div className="relative rounded-t bg-purple-600/80" style={{ height: alto(valor), minHeight: valor ? 2 : 0 }} />
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-content-muted">
        <span>{etiquetaSemana(semanas[0].inicio)}</span>
        <span>{etiquetaSemana(semanas[semanas.length - 1].inicio)}</span>
        <span className="font-medium text-purple-700 dark:text-purple-300">Semana del {etiquetaSemana(inicioVentana)} (estimada)</span>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-[11px] text-content-secondary">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-400" aria-hidden="true" /> Observado (semanas completas)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-purple-600/80" aria-hidden="true" /> Estimación experimental
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-0 border-l-2 border-purple-400" aria-hidden="true" /> Intervalo
        </span>
      </figcaption>
    </figure>
  );
}
