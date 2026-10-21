import { useState } from "react";
import { Link } from "react-router-dom";
import Card from "@/components/ui/Card";
import { IconInfo, IconML } from "@/components/ui/Icons";
import type { DatasetOpcion, NuevoExperimento as Formulario, Tarea } from "../types";
import { TAREAS, validarFormulario } from "../schemas/ml.schema";

const campoCls =
  "rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none";
const etiquetaCls = "text-[11px] font-medium text-content-secondary";

interface NuevoExperimentoProps {
  puedeEntrenar: boolean;
  datasets: DatasetOpcion[] | null;
  entrenando: boolean;
  errorApi: string | null;
  onEntrenar: (formulario: Formulario) => void;
}

/** Formulario para entrenar un experimento sobre un dataset aprobado. */
export default function NuevoExperimento({ puedeEntrenar, datasets, entrenando, errorApi, onEntrenar }: NuevoExperimentoProps) {
  const [f, setF] = useState<Formulario>({ name: "", task_type: "conteo_semanal", dataset_id: "", semilla: 42 });
  const [intentado, setIntentado] = useState(false);
  const problema = validarFormulario(f);
  const set = (patch: Partial<Formulario>) => setF((p) => ({ ...p, ...patch }));

  const tarea = TAREAS.find((t) => t.value === f.task_type);
  const dataset = datasets?.find((d) => d.id === f.dataset_id);
  const avisoDataset =
    dataset && !dataset.tieneCorte
      ? "Este dataset no tiene fecha de corte: el experimento fallará (hace falta una partición temporal)."
      : dataset && f.task_type === "regresion_lineal" && !dataset.tieneObjetivo
        ? "Este dataset no tiene variable objetivo: la regresión lineal fallará."
        : null;

  const enviar = () => {
    setIntentado(true);
    if (problema || !puedeEntrenar) return;
    onEntrenar({ ...f, name: f.name.trim() });
  };

  return (
    <Card
      title="Nuevo experimento"
      help="Entrena con un dataset aprobado y lo evalúa en su partición de prueba. Se guarda con su semilla y versiones de librerías."
    >
      {!puedeEntrenar && (
        <p role="note" className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-[11px] text-content-secondary">
          <IconInfo size={13} className="mt-0.5 shrink-0" />
          Tu rol puede consultar experimentos, pero no entrenarlos.
        </p>
      )}
      {datasets && datasets.length === 0 && (
        <p role="note" className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-[11px] text-content-secondary">
          <IconInfo size={13} className="mt-0.5 shrink-0" />
          <span>
            No hay datasets aprobados. Crea y aprueba uno en{" "}
            <Link to="/preparacion-datos" className="font-medium text-accent-700 underline dark:text-accent-300">
              Preparación de datos
            </Link>
            .
          </span>
        </p>
      )}

      <fieldset disabled={!puedeEntrenar || entrenando} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className={etiquetaCls}>Nombre</span>
          <input
            value={f.name}
            onChange={(e) => set({ name: e.target.value })}
            maxLength={120}
            placeholder="p. ej. conteo_m45_corte2022"
            className={campoCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiquetaCls}>Tarea</span>
          <select value={f.task_type} onChange={(e) => set({ task_type: e.target.value as Tarea })} className={campoCls}>
            {TAREAS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiquetaCls}>Dataset aprobado</span>
          <select value={f.dataset_id} onChange={(e) => set({ dataset_id: e.target.value })} className={campoCls}>
            <option value="">{datasets === null ? "Cargando…" : "Elige un dataset"}</option>
            {datasets?.map((d) => (
              <option key={d.id} value={d.id}>{d.etiqueta}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiquetaCls}>Semilla (reproducibilidad)</span>
          <input
            type="number"
            min={0}
            step={1}
            value={f.semilla}
            onChange={(e) => set({ semilla: Number(e.target.value) })}
            className={campoCls}
          />
        </label>
      </fieldset>

      {tarea && <p className="mt-2 text-[11px] text-content-muted">{tarea.descripcion}</p>}
      {avisoDataset && <p className="mt-1 text-[11px] text-content-secondary">⚠ {avisoDataset}</p>}

      {(intentado && problema) || errorApi ? (
        <p role="alert" className="mt-3 rounded-md border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2 text-[11px] text-content-secondary">
          {errorApi ?? problema}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-[11px] text-content-muted">Si falla, queda registrado con su motivo. Todo queda en la Auditoría.</span>
        <button
          type="button"
          onClick={enviar}
          disabled={!puedeEntrenar || entrenando}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconML size={13} />
          {entrenando ? "Entrenando…" : "Entrenar"}
        </button>
      </div>
    </Card>
  );
}
