import { fmtValor } from "../schemas/estimaciones.schema";

interface BarraIntervaloProps {
  valor: number;
  inferior: number;
  superior: number;
  referencia: number | null;
  nivel: number;
  compacta?: boolean;
}

/**
 * Valor estimado con su intervalo y la media histórica, sobre una escala que
 * empieza en 0 (sin ejes truncados que exageren diferencias, PDF §11).
 */
export default function BarraIntervalo({ valor, inferior, superior, referencia, nivel, compacta = false }: BarraIntervaloProps) {
  const maximo = Math.max(superior, referencia ?? 0, valor, 1) * 1.15;
  const pct = (v: number) => `${(v / maximo) * 100}%`;
  const etiqueta = `Estimación ${fmtValor(valor)}, intervalo del ${Math.round(nivel * 100)} % entre ${fmtValor(inferior)} y ${fmtValor(superior)}${
    referencia != null ? `, media histórica ${fmtValor(referencia)}` : ""
  }`;

  return (
    <div role="img" aria-label={etiqueta} className={compacta ? "w-40" : "w-full"}>
      <div className={`relative rounded-full bg-surface-tertiary ${compacta ? "h-2" : "h-3"}`}>
        <div
          className="absolute inset-y-0 rounded-full bg-purple-200 dark:bg-purple-800"
          style={{ left: pct(inferior), width: `calc(${pct(superior)} - ${pct(inferior)})` }}
        />
        {referencia != null && (
          <div
            className="absolute -inset-y-1 w-0 border-l-2 border-dashed border-slate-500"
            style={{ left: pct(referencia) }}
            title={`Media histórica: ${fmtValor(referencia)}`}
          />
        )}
        <div
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-700 ring-2 ring-surface ${compacta ? "h-2.5 w-2.5" : "h-3.5 w-3.5"}`}
          style={{ left: pct(valor) }}
        />
      </div>
      {!compacta && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-content-secondary">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-purple-700" aria-hidden="true" /> Estimación: {fmtValor(valor)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-full bg-purple-200 dark:bg-purple-800" aria-hidden="true" />
            Intervalo {Math.round(nivel * 100)} %: {fmtValor(inferior)} – {fmtValor(superior)}
          </span>
          {referencia != null && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-0 border-l-2 border-dashed border-slate-500" aria-hidden="true" /> Media histórica:{" "}
              {fmtValor(referencia)}
            </span>
          )}
          <span className="text-content-muted">Escala desde 0</span>
        </div>
      )}
    </div>
  );
}
