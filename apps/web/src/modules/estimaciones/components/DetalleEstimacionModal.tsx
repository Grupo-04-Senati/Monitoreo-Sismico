import ExpandModal from "@/components/ui/ExpandModal";
import { IconAlertTriangle } from "@/components/ui/Icons";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { Estimacion } from "../types";
import { ETIQUETA_ALGORITMO, fmtValor, fmtVentana } from "../schemas/estimaciones.schema";
import BarraIntervalo from "./BarraIntervalo";
import GraficoEntradas from "./GraficoEntradas";
import InsigniaEstimacion from "./InsigniaEstimacion";

interface DetalleEstimacionModalProps {
  estimacion: Estimacion;
  puedeRevisar: boolean;
  revisando: boolean;
  onRevisar: (e: Estimacion, accion: "publish" | "withdraw") => void;
  onCerrar: () => void;
}

/** Detalle de una estimación: valor e intervalo, entradas, procedencia y revisión. */
export default function DetalleEstimacionModal({ estimacion: e, puedeRevisar, revisando, onRevisar, onCerrar }: DetalleEstimacionModalProps) {
  const ficha: [string, string][] = [
    ["Semana estimada (UTC)", fmtVentana(e.window_start, e.window_end)],
    ["Indicador", "Sismos por semana"],
    ["Unidad espacial", e.area_description],
    ["Modelo", e.model_name ? `${e.model_name} · v${e.model_version}` : "—"],
    ["Algoritmo", e.algorithm ? ETIQUETA_ALGORITMO[e.algorithm] ?? e.algorithm : "—"],
    ["Método del intervalo", `${e.method} (${e.inputs.errores_usados ?? "—"} semanas de prueba)`],
    ["Calculada", fmtDateTimeUTC5(e.calculated_at)],
    ["Revisada", e.reviewed_at ? fmtDateTimeUTC5(e.reviewed_at) : "—"],
  ];

  const pie = (
    <div className="flex flex-wrap items-center gap-2">
      <InsigniaEstimacion estado={e.status} />
      <span className="text-content-muted">
        {e.status === "retirada"
          ? "Retirada: ya no se considera válida."
          : puedeRevisar
            ? "Publicar no la convierte en alerta: sigue siendo una estimación experimental."
            : "Solo un Administrador puede publicarla o retirarla."}
      </span>
      {puedeRevisar && e.status === "en_revision" && (
        <button
          type="button"
          onClick={() => onRevisar(e, "publish")}
          disabled={revisando}
          className="ml-auto rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:opacity-40"
        >
          Publicar
        </button>
      )}
      {puedeRevisar && e.status !== "retirada" && (
        <button
          type="button"
          onClick={() => onRevisar(e, "withdraw")}
          disabled={revisando}
          className={`${e.status === "en_revision" ? "" : "ml-auto "}rounded-md border border-border px-3 py-1.5 text-xs font-medium text-content transition-colors hover:bg-surface-secondary disabled:opacity-40`}
        >
          Retirar
        </button>
      )}
    </div>
  );

  return (
    <ExpandModal title={`Estimación · ${fmtVentana(e.window_start, e.window_end)}`} onClose={onCerrar} footer={pie} resizable>
      <div className="space-y-4">
        <div className="rounded-lg border border-border border-l-2 border-l-purple-500 bg-surface px-3 py-2 text-[11px] text-content-secondary">
          {e.disclaimer}
        </div>

        <section>
          <p className="text-xs text-content-secondary">Sismos estimados en la semana</p>
          <p className="mt-0.5 text-3xl font-bold text-purple-800 dark:text-purple-200">
            {fmtValor(e.value)}{" "}
            <span className="text-sm font-normal text-content-secondary">
              (intervalo {Math.round(e.confidence_level * 100)} %: {fmtValor(e.lower_bound)} – {fmtValor(e.upper_bound)})
            </span>
          </p>
          <div className="mt-3">
            <BarraIntervalo valor={e.value} inferior={e.lower_bound} superior={e.upper_bound} referencia={e.reference_value} nivel={e.confidence_level} />
          </div>
        </section>

        {e.warnings.length > 0 && (
          <div className="rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3 py-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-content">
              <IconAlertTriangle size={13} className="text-accent-600" /> Advertencias ({e.warnings.length})
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-[11px] text-content-secondary">
              {e.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <section>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-content-secondary">Entradas del modelo</h4>
          <GraficoEntradas
            semanas={e.inputs.semanas ?? []}
            valor={e.value}
            inferior={e.lower_bound}
            superior={e.upper_bound}
            inicioVentana={e.window_start}
          />
        </section>

        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
          {ficha.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-content-secondary">{k}</dt>
              <dd className="break-words font-medium text-content">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </ExpandModal>
  );
}
