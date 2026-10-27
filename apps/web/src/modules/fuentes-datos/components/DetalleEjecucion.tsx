import type { ReactNode } from "react";
import type { EjecucionFuente } from "../types";
import { ETIQUETA_EJECUCION } from "../schemas/fuentes.schema";
import { fmtDateTimeUTC5 } from "@/lib/format";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/Icons";

const btnNav =
  "inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-content-secondary transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-40";

function TarjetaDato({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary px-3 py-2.5">
      <span className="block text-[10px] uppercase tracking-[0.04em] text-content-muted">{etiqueta}</span>
      <b className="mt-0.5 block text-[15px] font-semibold leading-snug text-content">{valor}</b>
      {detalle && <span className="mt-0.5 block text-[11px] text-content-muted">{detalle}</span>}
    </div>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 last:border-0">
      <dt className="text-[11px] text-content-muted">{etiqueta}</dt>
      <dd className="text-right text-xs text-content">{children}</dd>
    </div>
  );
}

export interface DetalleEjecucionProps {
  ejecucion: EjecucionFuente;
  posicion: number;
  total: number;
  hayAnterior: boolean;
  haySiguiente: boolean;
  onAnterior: () => void;
  onSiguiente: () => void;
  /** Una sola columna (para el panel lateral). */
  compacto?: boolean;
}

/** Contenido del detalle de una ejecución (sin modal), reutilizable. */
export default function DetalleEjecucion({
  ejecucion,
  posicion,
  total,
  hayAnterior,
  haySiguiente,
  onAnterior,
  onSiguiente,
  compacto = false,
}: DetalleEjecucionProps) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onAnterior} disabled={!hayAnterior} className={btnNav}>
          <IconChevronLeft size={13} />
          Anterior
        </button>
        <button type="button" onClick={onSiguiente} disabled={!haySiguiente} className={btnNav}>
          Siguiente
          <IconChevronRight size={13} />
        </button>
        <span className="ml-auto text-xs text-content-muted" aria-live="polite">
          {posicion} / {total}
        </span>
      </div>

      <div className={`grid grid-cols-1 gap-2.5 ${compacto ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        <TarjetaDato
          etiqueta="Estado"
          valor={ETIQUETA_EJECUCION[ejecucion.estado]}
          detalle={ejecucion.desencadenante === "manual" ? "Sincronización manual" : "Programada (cada 15 min)"}
        />
        <TarjetaDato etiqueta="Inicio (UTC-5)" valor={fmtDateTimeUTC5(ejecucion.inicioUtc)} detalle={`${ejecucion.inicioUtc} (UTC)`} />
        <TarjetaDato etiqueta="Duración" valor={ejecucion.estado === "en_curso" ? "En curso" : `${ejecucion.duracionMs} ms`} detalle={`Latencia: ${ejecucion.latenciaMs} ms`} />
        <TarjetaDato etiqueta="Leídos" valor={String(ejecucion.leidos)} detalle="Registros recibidos de la fuente" />
        <TarjetaDato etiqueta="Insertados" valor={String(ejecucion.insertados)} detalle="Nuevos tras deduplicar" />
        <TarjetaDato etiqueta="Corregidos" valor={String(ejecucion.corregidos)} detalle="Ya guardados, actualizados por la fuente (con historial)" />
        <TarjetaDato etiqueta="Duplicados omitidos" valor={String(ejecucion.duplicadosOmitidos)} detalle="Ya presentes (hash de origen)" />
      </div>

      {ejecucion.errorResumen && (
        <p
          role="note"
          className="mt-3 rounded-lg border border-border border-l-2 border-l-warning bg-surface px-3.5 py-2 text-[11px] leading-relaxed text-content-secondary"
        >
          <b className="font-semibold text-content">Incidencia:</b> {ejecucion.errorResumen}
        </p>
      )}

      <details className="group mt-4 rounded-lg border border-border bg-surface-secondary" open={ejecucion.estado !== "correcta"}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-content">
          <IconChevronRight size={14} className="transition-transform group-open:rotate-90" />
          Datos técnicos
        </summary>
        <div className="border-t border-border px-3.5 py-1.5">
          <dl>
            <Dato etiqueta="Estado HTTP">
              {ejecucion.httpStatus == null ? "—" : <span className="font-mono">{ejecucion.httpStatus}</span>}
            </Dato>
            <Dato etiqueta="Correlación">
              <code className="font-mono text-[11px]" title={ejecucion.correlacion}>
                {ejecucion.correlacion}
              </code>
            </Dato>
            <Dato etiqueta="Intentos">{ejecucion.intentos}</Dato>
            <Dato etiqueta="Desencadenante">{ejecucion.desencadenante === "manual" ? "Manual" : "Programada"}</Dato>
          </dl>
        </div>
      </details>

      <p role="note" className="mt-3 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2 text-[11px] leading-relaxed text-content-secondary">
        La ingesta es idempotente: reprocesar la misma ventana no genera eventos duplicados; los ya vistos se cuentan como
        duplicados omitidos.
      </p>
    </>
  );
}
