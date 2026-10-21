import { useState } from "react";
import { Link } from "react-router";
import Card from "@/components/ui/Card";
import { IconEstimate, IconInfo } from "@/components/ui/Icons";
import type { ModeloOpcion } from "../types";

const campoCls =
  "rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none";

interface NuevaEstimacionProps {
  puedeGenerar: boolean;
  modelos: ModeloOpcion[] | null;
  generando: boolean;
  errorApi: string | null;
  onGenerar: (modelId: string) => void;
}

/** Genera la estimación de la semana en curso con un modelo aprobado. */
export default function NuevaEstimacion({ puedeGenerar, modelos, generando, errorApi, onGenerar }: NuevaEstimacionProps) {
  const [modelo, setModelo] = useState("");
  const [intentado, setIntentado] = useState(false);

  const enviar = () => {
    setIntentado(true);
    if (!modelo || !puedeGenerar) return;
    onGenerar(modelo);
  };

  return (
    <Card
      title="Nueva estimación"
      help="Estima cuántos sismos habrá en la semana en curso (lunes a lunes, UTC) con las 12 semanas completas anteriores. Nace en revisión."
    >
      {!puedeGenerar && (
        <p role="note" className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-[11px] text-content-secondary">
          <IconInfo size={13} className="mt-0.5 shrink-0" />
          Tu rol puede consultar estimaciones, pero no generarlas.
        </p>
      )}
      {modelos && modelos.length === 0 && (
        <p role="note" className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-[11px] text-content-secondary">
          <IconInfo size={13} className="mt-0.5 shrink-0" />
          <span>
            No hay modelos aprobados de conteo semanal. Entrena y aprueba uno en{" "}
            <Link to="/modelos-ml" className="font-medium text-accent-700 underline dark:text-accent-300">
              Modelos ML
            </Link>
            .
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[260px] flex-1 flex-col gap-1">
          <span className="text-[11px] font-medium text-content-secondary">Modelo aprobado (conteo semanal)</span>
          <select value={modelo} onChange={(e) => setModelo(e.target.value)} disabled={!puedeGenerar || generando} className={campoCls}>
            <option value="">{modelos === null ? "Cargando…" : "Elige un modelo"}</option>
            {modelos?.map((m) => (
              <option key={m.id} value={m.id}>{m.etiqueta}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={enviar}
          disabled={!puedeGenerar || generando}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconEstimate size={13} />
          {generando ? "Calculando…" : "Generar estimación"}
        </button>
      </div>

      {(intentado && !modelo) || errorApi ? (
        <p role="alert" className="mt-3 rounded-md border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2 text-[11px] text-content-secondary">
          {errorApi ?? "Elige un modelo aprobado."}
        </p>
      ) : null}
      <p className="mt-3 text-[11px] text-content-muted">
        Se cuenta con las mismas reglas del dataset del modelo. El intervalo sale de los errores reales del modelo en su
        prueba. Queda en la Auditoría.
      </p>
    </Card>
  );
}
