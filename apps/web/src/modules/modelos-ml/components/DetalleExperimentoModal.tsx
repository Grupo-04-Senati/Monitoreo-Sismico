import { useState } from "react";
import ExpandModal from "@/components/ui/ExpandModal";
import { IconAlertTriangle, IconCheck } from "@/components/ui/Icons";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { Experimento } from "../types";
import { ES_REFERENCIA, ETIQUETA_MODELO, ETIQUETA_TAREA, etiquetaVariable, fmtMejora, fmtNum } from "../schemas/ml.schema";
import GraficoRealEstimado from "./GraficoRealEstimado";
import InsigniaEstadoExperimento from "./InsigniaEstadoExperimento";

type Pestana = "comparacion" | "curva" | "coeficientes" | "ficha";

interface DetalleExperimentoModalProps {
  experimento: Experimento;
  puedeAprobar: boolean;
  aprobando: boolean;
  onAprobar: (experimento: Experimento, limitaciones: string) => void;
  onCerrar: () => void;
}

function Lista({ titulo, items }: { titulo: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3 py-2.5">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-content">
        <IconAlertTriangle size={13} className="text-accent-600" />
        {titulo} ({items.length})
      </p>
      <ul className="list-disc space-y-0.5 pl-5 text-[11px] text-content-secondary">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function Comparacion({ e }: { e: Experimento }) {
  const referencias = Object.keys(e.metrics).filter(ES_REFERENCIA);
  return (
    <div className="space-y-3">
      <Lista titulo="Advertencias" items={e.warnings} />
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <caption className="sr-only">Métricas en la partición de prueba por modelo</caption>
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              {["Modelo", "MAE", "RMSE", "R²", ...referencias.map((r) => `Mejora vs ${ETIQUETA_MODELO[r]?.replace("Referencia: ", "") ?? r}`)].map((h) => (
                <th key={h} scope="col" className="px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-content-secondary">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(e.metrics).map(([modelo, m]) => {
              const mejor = modelo === e.algorithm;
              return (
                <tr key={modelo} className={`border-b border-border last:border-0 ${mejor ? "bg-surface-tertiary" : ""}`}>
                  <td className="px-2.5 py-1.5 text-content">
                    <span className={mejor ? "font-semibold" : ""}>{ETIQUETA_MODELO[modelo] ?? modelo}</span>
                    {mejor && <span className="ml-1.5 rounded bg-accent-600 px-1.5 py-0.5 text-[10px] text-white">menor MAE</span>}
                  </td>
                  <td className="px-2.5 py-1.5 text-content-secondary">{fmtNum(m.mae)}</td>
                  <td className="px-2.5 py-1.5 text-content-secondary">{fmtNum(m.rmse)}</td>
                  <td className="px-2.5 py-1.5 text-content-secondary">{fmtNum(m.r2)}</td>
                  {referencias.map((r) => (
                    <td key={r} className="px-2.5 py-1.5 text-content-secondary">
                      {ES_REFERENCIA(modelo) ? "—" : fmtMejora(e.results.mejora?.[modelo]?.[r])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-content-muted">
        Métricas en la partición de prueba (n = {Object.values(e.metrics)[0]?.n ?? "—"}). MAE es la métrica principal; una
        mejora positiva significa menor error que la referencia.
      </p>
    </div>
  );
}

function Coeficientes({ e }: { e: Experimento }) {
  const coef = e.results.coeficientes ?? {};
  if (Object.keys(coef).length === 0) return <p className="text-xs text-content-muted">Sin coeficientes.</p>;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {Object.entries(coef).map(([modelo, valores]) => (
        <section key={modelo} className="rounded-lg border border-border p-3">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-content-secondary">{ETIQUETA_MODELO[modelo] ?? modelo}</h4>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
            {Object.entries(valores).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-content-secondary">{etiquetaVariable(k)}</dt>
                <dd className="text-right font-mono text-content">{fmtNum(v, 6)}</dd>
              </div>
            ))}
          </dl>
          {modelo === "regresion_poisson" && (
            <p className="mt-2 text-[10px] text-content-muted">En Poisson los coeficientes actúan sobre el logaritmo del conteo esperado.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function Ficha({ e }: { e: Experimento }) {
  const filas: [string, string][] = [
    ["Tarea", ETIQUETA_TAREA[e.task_type] ?? e.task_type],
    ["Dataset", e.params.dataset ?? e.dataset_id],
    ["Variables", e.feature_spec.map(etiquetaVariable).join(", ") || "—"],
    ["Objetivo", e.target_name ? etiquetaVariable(e.target_name) : "—"],
    ["Semilla", String(e.seed)],
    ...Object.entries(e.validation_spec)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [`Validación · ${k.replace(/_/g, " ")}`, Array.isArray(v) ? v.join(", ") : String(v)] as [string, string]),
    ["Versiones", Object.entries(e.library_versions).map(([k, v]) => `${k} ${v}`).join(" · ")],
    ["Artefacto", e.artifact_uri ?? "—"],
    ["Creado", fmtDateTimeUTC5(e.created_at)],
  ];
  return (
    <div className="space-y-3">
      <Lista titulo="Limitaciones" items={e.limitations} />
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
        {filas.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-content-secondary">{k}</dt>
            <dd className="break-words font-medium text-content">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Detalle de un experimento: comparación, curva real-vs-estimada, coeficientes, ficha y aprobación. */
export default function DetalleExperimentoModal({ experimento: e, puedeAprobar, aprobando, onAprobar, onCerrar }: DetalleExperimentoModalProps) {
  const [pestana, setPestana] = useState<Pestana>(e.status === "fallido" ? "ficha" : "comparacion");
  const [limitaciones, setLimitaciones] = useState("");
  const gananReferencias = ES_REFERENCIA(e.algorithm);
  const aprobable = e.status === "completado" && !gananReferencias && !e.model_id;

  // Para la curva se dibuja el mejor modelo (o, si gana una referencia, el mejor modelo real).
  const modelos = Object.keys(e.metrics).filter((m) => !ES_REFERENCIA(m));
  const modeloCurva = e.algorithm && !gananReferencias ? e.algorithm : modelos.sort((a, b) => (e.metrics[a].mae ?? 0) - (e.metrics[b].mae ?? 0))[0];

  const pie = (
    <div className="flex flex-wrap items-center gap-2">
      <InsigniaEstadoExperimento estado={e.status} aprobado={!!e.model_id} />
      <span className="text-content-muted">
        {e.status === "fallido"
          ? "Experimento fallido: no se puede aprobar."
          : e.model_id
            ? "Ya existe un modelo aprobado a partir de este experimento."
            : gananReferencias
              ? "Gana una referencia: no hay modelo que aprobar."
              : puedeAprobar
                ? "Al aprobarlo, podrá publicar estimaciones experimentales."
                : "Solo un Administrador puede aprobar el modelo."}
      </span>
      {aprobable && puedeAprobar && (
        <>
          <input
            value={limitaciones}
            onChange={(ev) => setLimitaciones(ev.target.value)}
            maxLength={1000}
            placeholder="Limitaciones adicionales (opcional)"
            aria-label="Limitaciones adicionales del modelo"
            className="ml-auto min-w-[220px] flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => onAprobar(e, limitaciones)}
            disabled={aprobando}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconCheck size={13} />
            {aprobando ? "Aprobando…" : "Aprobar modelo"}
          </button>
        </>
      )}
    </div>
  );

  const pestanas: { id: Pestana; etiqueta: string; visible: boolean }[] = [
    { id: "comparacion", etiqueta: "Comparación de modelos", visible: e.status === "completado" },
    { id: "curva", etiqueta: "Real vs. estimado", visible: e.status === "completado" },
    { id: "coeficientes", etiqueta: "Coeficientes", visible: e.status === "completado" },
    { id: "ficha", etiqueta: "Ficha", visible: true },
  ];

  return (
    <ExpandModal title={e.name} onClose={onCerrar} footer={pie} resizable>
      {e.status === "fallido" && (
        <p role="alert" className="mb-3 rounded-md border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2 text-xs text-content-secondary">
          No se pudo entrenar: {e.error}
        </p>
      )}
      <div role="tablist" aria-label="Secciones del experimento" className="mb-3 flex flex-wrap gap-1 border-b border-border">
        {pestanas
          .filter((p) => p.visible)
          .map((p) => (
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

      {pestana === "comparacion" && <Comparacion e={e} />}
      {pestana === "curva" && modeloCurva && (
        <GraficoRealEstimado
          serie={e.results.serie_prueba ?? []}
          ejeX={e.task_type === "conteo_semanal" ? "semana" : undefined}
          modelo={modeloCurva}
          etiquetaModelo={ETIQUETA_MODELO[modeloCurva] ?? modeloCurva}
          unidad={e.task_type === "conteo_semanal" ? "sismos por semana" : etiquetaVariable(e.target_name ?? "")}
        />
      )}
      {pestana === "coeficientes" && <Coeficientes e={e} />}
      {pestana === "ficha" && <Ficha e={e} />}
    </ExpandModal>
  );
}
