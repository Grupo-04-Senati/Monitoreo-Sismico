import type { ReactNode } from "react";
import { DATA_MIN_DAY, DATA_MAX_DAY } from "@/lib/ancla";
import type { FiltrosAnalisis, ClaveFiltro, Agrupacion, MetodoCorrelacion, TopRegiones, VariableId, Resolucion, PeriodoAnalisis, TipoFiltro } from "../types";
import {
  AGRUPACIONES,
  CLAVES_ANALISIS,
  CLAVES_DATOS,
  METODOS,
  PERIODOS,
  REGIONES,
  RESOLUCIONES,
  TIPOS_MAGNITUD,
  TOPS,
  VARIABLES_OPCIONES,
} from "../schemas/analisis.schema";

interface FiltrosAnalisisProps {
  filtros: FiltrosAnalisis;
  onCambiar: (parcial: Partial<FiltrosAnalisis>) => void;
  /** Claves a mostrar; si no se indica, se muestran todas. */
  incluir?: ClaveFiltro[];
  variante?: "tarjeta" | "plano";
}

const input =
  "w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none";
const label = "mb-1 block text-[11px] font-semibold text-content-muted";
const seg = (on: boolean) =>
  `px-2.5 py-1 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
    on ? "bg-accent-600 text-white" : "bg-surface text-content-secondary hover:bg-surface-tertiary"
  }`;

export default function FiltrosAnalisis({
  filtros,
  onCambiar,
  incluir,
  variante = "tarjeta",
}: FiltrosAnalisisProps) {
  const visible = (k: ClaveFiltro) => !incluir || incluir.includes(k);
  const hayDatos = CLAVES_DATOS.some(visible);
  const hayAnalisis = CLAVES_ANALISIS.some(visible);

  const numero = (v: string): number | null => (v === "" ? null : Number(v));

  const campo = (k: ClaveFiltro, etiqueta: string, control: ReactNode) =>
    visible(k) ? (
      <div key={k}>
        <label className={label}>{etiqueta}</label>
        {control}
      </div>
    ) : null;

  const grupo = (titulo: string, children: ReactNode) => (
    <div className="mb-3 last:mb-0">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-content-muted">{titulo}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
    </div>
  );

  const contenido = (
    <>
      {hayDatos &&
        grupo(
          "Datos",
          <>
            {visible("periodo") && (
              <div className="col-span-2">
                <label className={label}>Periodo</label>
                <div className="flex overflow-hidden rounded-md border border-border">
                  {PERIODOS.filter((p) => p.value !== "rango").map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => onCambiar({ periodo: p.value as PeriodoAnalisis })}
                      className={seg(filtros.periodo === p.value)}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => onCambiar({ periodo: "rango" })}
                    className={seg(filtros.periodo === "rango")}
                  >
                    Rango
                  </button>
                </div>
              </div>
            )}

            {visible("periodo") && filtros.periodo === "rango" && (
              <div className="col-span-2">
                <label className={label}>Fecha inicial / final</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    className={input}
                    min={DATA_MIN_DAY}
                    max={DATA_MAX_DAY}
                    value={filtros.desde}
                    onChange={(e) => onCambiar({ desde: e.target.value })}
                    aria-label="Fecha inicial"
                  />
                  <input
                    type="date"
                    className={input}
                    min={DATA_MIN_DAY}
                    max={DATA_MAX_DAY}
                    value={filtros.hasta}
                    onChange={(e) => onCambiar({ hasta: e.target.value })}
                    aria-label="Fecha final"
                  />
                </div>
              </div>
            )}

            {campo(
              "zona",
              "Zona (región)",
              <select className={input} value={filtros.zona} onChange={(e) => onCambiar({ zona: e.target.value })}>
                <option value="">Todo el Perú</option>
                {REGIONES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>,
            )}

            {campo(
              "magnitud",
              "Magnitud (mín / máx)",
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  placeholder="mín"
                  className={input}
                  value={filtros.magnitudMin ?? ""}
                  onChange={(e) => onCambiar({ magnitudMin: numero(e.target.value) })}
                  aria-label="Magnitud mínima"
                />
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  placeholder="máx"
                  className={input}
                  value={filtros.magnitudMax ?? ""}
                  onChange={(e) => onCambiar({ magnitudMax: numero(e.target.value) })}
                  aria-label="Magnitud máxima"
                />
              </div>,
            )}

            {campo(
              "tipo",
              "Tipo de magnitud",
              <select
                className={input}
                value={filtros.tipo}
                onChange={(e) => onCambiar({ tipo: e.target.value as TipoFiltro })}
              >
                {TIPOS_MAGNITUD.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>,
            )}

            {campo(
              "profundidad",
              "Profundidad km (mín / máx)",
              <div className="flex gap-2">
                <input
                  type="number"
                  step="1"
                  min={0}
                  placeholder="mín"
                  className={input}
                  value={filtros.profundidadMin ?? ""}
                  onChange={(e) => onCambiar({ profundidadMin: numero(e.target.value) })}
                  aria-label="Profundidad mínima"
                />
                <input
                  type="number"
                  step="1"
                  min={0}
                  placeholder="máx"
                  className={input}
                  value={filtros.profundidadMax ?? ""}
                  onChange={(e) => onCambiar({ profundidadMax: numero(e.target.value) })}
                  aria-label="Profundidad máxima"
                />
              </div>,
            )}
          </>,
        )}

      {hayAnalisis &&
        grupo(
          "Análisis",
          <>
            {campo(
              "agrupacion",
              "Agrupación temporal",
              <select
                className={input}
                value={filtros.agrupacion}
                onChange={(e) => onCambiar({ agrupacion: e.target.value as Agrupacion })}
              >
                {AGRUPACIONES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>,
            )}

            {campo(
              "resolucion",
              "Resolución",
              <select
                className={input}
                value={filtros.resolucion}
                onChange={(e) => onCambiar({ resolucion: Number(e.target.value) as Resolucion })}
              >
                {RESOLUCIONES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>,
            )}

            {campo(
              "x",
              "Variable X",
              <select className={input} value={filtros.x} onChange={(e) => onCambiar({ x: e.target.value as VariableId })}>
                {VARIABLES_OPCIONES.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>,
            )}

            {campo(
              "y",
              "Variable Y",
              <select className={input} value={filtros.y} onChange={(e) => onCambiar({ y: e.target.value as VariableId })}>
                {VARIABLES_OPCIONES.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>,
            )}

            {campo(
              "metodo",
              "Método de correlación",
              <select
                className={input}
                value={filtros.metodo}
                onChange={(e) => onCambiar({ metodo: e.target.value as MetodoCorrelacion })}
              >
                {METODOS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>,
            )}

            {campo(
              "top",
              "Regiones a mostrar",
              <select
                className={input}
                value={filtros.top}
                onChange={(e) => onCambiar({ top: Number(e.target.value) as TopRegiones })}
              >
                {TOPS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>,
            )}
          </>,
        )}
    </>
  );

  if (variante === "plano") {
    return <div>{contenido}</div>;
  }

  return (
    <section
      className="auth-surface mb-3 rounded-[10px] border border-border bg-surface px-3.5 py-3"
      aria-label="Filtros del análisis"
    >
      {contenido}
    </section>
  );
}
