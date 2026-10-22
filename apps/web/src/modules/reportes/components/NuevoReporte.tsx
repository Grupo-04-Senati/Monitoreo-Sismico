import { useState } from "react";
import Card from "@/components/ui/Card";
import { IconInfo, IconReport } from "@/components/ui/Icons";
import { NOW } from "@/lib/ancla";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { ParametrosReporte } from "../types";
import type { ZonaOption } from "../schemas/reportes.schema";
import {
  ESTADOS_REVISION,
  FORMATOS,
  PERIODOS,
  TIPOS,
  parametrosIniciales,
  validarParametros,
} from "../schemas/reportes.schema";

const campoCls =
  "rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none";

interface NuevoReporteProps {
  puedeGenerar: boolean;
  puedePdf: boolean;
  zonas: ZonaOption[];
  creando: boolean;
  onCrear: (parametros: ParametrosReporte) => void;
}

const MAGNITUDES = [
  { value: "", label: "Cualquier magnitud" },
  { value: "3", label: "Magnitud ≥ 3.0" },
  { value: "4", label: "Magnitud ≥ 4.0" },
  { value: "5", label: "Magnitud ≥ 5.0" },
];

/** Panel de solicitud de un informe: tipo, periodo, filtros, formato y vista previa. */
export default function NuevoReporte({ puedeGenerar, puedePdf, zonas, creando, onCrear }: NuevoReporteProps) {
  const [parametros, setParametros] = useState<ParametrosReporte>(parametrosIniciales);

  const validacion = validarParametros(parametros, puedePdf);

  const set = (patch: Partial<ParametrosReporte>) =>
    setParametros((p) => ({ ...p, ...patch, ...(patch.tipo && patch.tipo !== "eventos" ? { zona: "", magnitudMin: null, reviewStatus: "" } : {}) }));

  const enviar = () => {
    if (!validacion.ok || !puedeGenerar) return;
    onCrear(parametros);
    setParametros(parametrosIniciales());
  };

  return (
    <Card
      title="Nuevo informe"
      help="Elige el tipo, el periodo (fecha de corte) y el formato. Verás cuántas filas incluirá antes de generarlo."
    >
      {!puedeGenerar && (
        <p role="note" className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-[11px] text-content-secondary">
          <IconInfo size={13} className="mt-0.5 shrink-0" />
          Tu rol puede consultar y descargar informes, pero no solicitarlos.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-content-secondary">Tipo de informe</span>
          <select
            value={parametros.tipo}
            onChange={(e) => set({ tipo: e.target.value as ParametrosReporte["tipo"] })}
            className={campoCls}
          >
            {TIPOS.map((t) => (
              <option key={t.tipo} value={t.tipo} disabled={!t.disponible}>
                {t.nombre}{t.disponible ? "" : " (Disponible próximamente)"}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-content-secondary">Periodo</span>
          <select
            value={parametros.periodo}
            onChange={(e) => set({ periodo: e.target.value as ParametrosReporte["periodo"] })}
            className={campoCls}
          >
            {PERIODOS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        {parametros.periodo === "personalizado" ? (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-content-secondary">Desde</span>
              <input
                type="date"
                value={parametros.desde}
                max={parametros.hasta || undefined}
                onChange={(e) => set({ desde: e.target.value })}
                className={campoCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-content-secondary">Hasta</span>
              <input
                type="date"
                value={parametros.hasta}
                min={parametros.desde || undefined}
                onChange={(e) => set({ hasta: e.target.value })}
                className={campoCls}
              />
            </label>
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-content-secondary">Fecha de corte</span>
            <span className="px-0.5 py-1.5 text-xs text-content-secondary">{fmtDateTimeUTC5(NOW.toISOString())}</span>
          </div>
        )}

        {parametros.tipo === "eventos" && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-content-secondary">Zona</span>
              <select value={parametros.zona} onChange={(e) => set({ zona: e.target.value })} className={campoCls}>
                <option value="">Todas las regiones</option>
                {zonas.map((z) => (
                  <option key={z.slug} value={z.slug}>{z.name}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-content-secondary">Magnitud mínima</span>
              <select
                value={parametros.magnitudMin == null ? "" : String(parametros.magnitudMin)}
                onChange={(e) => set({ magnitudMin: e.target.value ? Number(e.target.value) : null })}
                className={campoCls}
              >
                {MAGNITUDES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-content-secondary">Estado de revisión</span>
              <select
                value={parametros.reviewStatus}
                onChange={(e) => set({ reviewStatus: e.target.value as ParametrosReporte["reviewStatus"] })}
                className={campoCls}
              >
                {ESTADOS_REVISION.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </>
        )}

        <fieldset className="sm:col-span-2 lg:col-span-4">
          <legend className="text-[11px] font-medium text-content-secondary">Formato</legend>
          <div className="mt-1.5 flex flex-wrap gap-4">
            {FORMATOS.map((f) => {
              const bloqueado = f.requierePdf && !puedePdf;
              return (
                <label key={f.value} className={`flex items-start gap-2 text-xs ${bloqueado ? "opacity-50" : "text-content-secondary"}`}>
                  <input
                    type="radio"
                    name="formato-reporte"
                    checked={parametros.formato === f.value}
                    disabled={bloqueado}
                    onChange={() => set({ formato: f.value })}
                    className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent-500)]"
                  />
                  <span>
                    <b className="font-semibold text-content">{f.label}</b>
                    <span className="block text-[11px] text-content-muted">
                      {bloqueado ? "Tu rol no permite exportar en PDF." : f.detalle}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      {/* Vista previa */}
      <div className="mt-4 rounded-lg border border-border bg-surface-secondary p-3">
        <p className="flex items-center gap-2 text-xs text-content-secondary">
          <IconInfo size={13} className="text-content-muted" />
          El número de filas se conoce al generar el informe (columna «Filas» de la lista).
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {!validacion.ok && (
          <p role="alert" className="text-[11px] text-rose-600 dark:text-rose-400">{validacion.error}</p>
        )}
        <button
          type="button"
          onClick={enviar}
          disabled={!puedeGenerar || !validacion.ok || creando}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconReport size={14} />
          {creando ? "Solicitando…" : "Generar informe"}
        </button>
      </div>
    </Card>
  );
}
