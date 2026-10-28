import { useState } from "react";
import ExpandModal from "@/components/ui/ExpandModal";
import { IconCheck } from "@/components/ui/Icons";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { Dataset } from "../types";
import { ETIQUETA_VARIABLE, OPCIONES_DUPLICADOS, OPCIONES_PROFUNDIDAD, fmtDiaUTC, describirZona } from "../schemas/datasets.schema";
import InformeCalidad from "./InformeCalidad";
import InsigniaEstadoDataset from "./InsigniaEstadoDataset";
import VistaPrevia from "./VistaPrevia";

type Pestana = "calidad" | "vista" | "config";

interface DetalleDatasetModalProps {
  dataset: Dataset;
  puedeAprobar: boolean;
  aprobando: boolean;
  onAprobar: (dataset: Dataset) => void;
  onCerrar: () => void;
}

function configuracion(d: Dataset): [string, string][] {
  const r = d.cleaning_rules;
  return [
    ["Nombre y versión", `${d.name} · v${d.version}`],
    ["Descripción", d.description || "—"],
    ["Fuente", d.query_spec?.fuente ?? "Todas las fuentes"],
    ["Periodo (UTC)", `${fmtDiaUTC(d.period_start)} – ${fmtDiaUTC(d.period_end)}`],
    ["Zona", describirZona(d.query_spec?.zona)],
    ["Magnitud mínima", r.magnitud_minima == null ? "Sin mínimo" : String(r.magnitud_minima)],
    ["Solo revisados", r.solo_revisados ? "Sí" : "No"],
    ["Tipos de magnitud", r.tipos_magnitud ? r.tipos_magnitud.join(", ") : "Todos"],
    ["Sin profundidad", OPCIONES_PROFUNDIDAD.find((o) => o.value === r.sin_profundidad)?.label ?? r.sin_profundidad],
    ["Posibles duplicados", OPCIONES_DUPLICADOS.find((o) => o.value === r.posibles_duplicados)?.label ?? r.posibles_duplicados],
    ["Variables", d.variables.map((v) => ETIQUETA_VARIABLE[v] ?? v).join(", ")],
    ["Variable objetivo", d.target_name ? ETIQUETA_VARIABLE[d.target_name] ?? d.target_name : "—"],
    ["Fecha de corte (UTC)", d.split_date ? fmtDiaUTC(d.split_date) : "Sin partición"],
    ["Creado", fmtDateTimeUTC5(d.created_at)],
    ["Aprobado", d.approved_at ? fmtDateTimeUTC5(d.approved_at) : "—"],
  ];
}

/** Detalle de un dataset: informe de calidad, vista previa, configuración y aprobación. */
export default function DetalleDatasetModal({ dataset, puedeAprobar, aprobando, onAprobar, onCerrar }: DetalleDatasetModalProps) {
  const [pestana, setPestana] = useState<Pestana>("calidad");
  const aprobado = dataset.status === "aprobado";

  const pie = (
    <div className="flex flex-wrap items-center gap-2">
      <InsigniaEstadoDataset estado={dataset.status} />
      <span className="text-content-muted">
        {aprobado
          ? "Aprobado: no se puede modificar. Para cambiarlo, crea una versión nueva con el mismo nombre."
          : puedeAprobar
            ? "Revisa el informe antes de aprobar: después ya no se podrá modificar."
            : "Solo un Administrador puede aprobar el dataset."}
      </span>
      {!aprobado && puedeAprobar && (
        <button
          type="button"
          onClick={() => onAprobar(dataset)}
          disabled={aprobando}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconCheck size={13} />
          {aprobando ? "Aprobando…" : "Aprobar dataset"}
        </button>
      )}
    </div>
  );

  const pestanas: { id: Pestana; etiqueta: string }[] = [
    { id: "calidad", etiqueta: "Informe de calidad" },
    { id: "vista", etiqueta: `Vista previa (${dataset.row_count.toLocaleString("es-PE")})` },
    { id: "config", etiqueta: "Configuración" },
  ];

  return (
    <ExpandModal title={`${dataset.name} · v${dataset.version}`} onClose={onCerrar} footer={pie} resizable>
      <div role="tablist" aria-label="Secciones del dataset" className="mb-3 flex gap-1 border-b border-border">
        {pestanas.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pestana === p.id}
            onClick={() => setPestana(p.id)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-medium transition-colors ${
              pestana === p.id ? "border-accent-600 text-content" : "border-transparent text-content-muted hover:text-content"
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {pestana === "calidad" && <InformeCalidad informe={dataset.quality_report} />}
      {pestana === "vista" && <VistaPrevia datasetId={dataset.id} conParticion={dataset.split_date != null} />}
      {pestana === "config" && (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
          {configuracion(dataset).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-content-secondary">{k}</dt>
              <dd className="font-medium text-content">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </ExpandModal>
  );
}
