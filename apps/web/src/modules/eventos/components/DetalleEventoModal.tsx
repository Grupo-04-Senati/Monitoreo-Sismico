import { useState, type ReactNode } from "react";
import type { EventoSismico } from "../types";
import { ETIQUETA_ESTADO } from "../schemas/filtros.schema";
import { fmtDateTimeUTC5 } from "@/lib/format";
import { SOURCE_NAME, SOURCE_URL } from "@/config/fuente";
import { copyText } from "@/lib/export";
import ExpandModal from "@/components/ui/ExpandModal";
import { IconCheck, IconChevronLeft, IconChevronRight, IconMapPin } from "@/components/ui/Icons";

interface DetalleEventoModalProps {
  evento: EventoSismico;
  /** Posición 1-indexada del evento dentro del resultado filtrado. */
  posicion: number;
  total: number;
  hayAnterior: boolean;
  haySiguiente: boolean;
  onCerrar: () => void;
  onAnterior: () => void;
  onSiguiente: () => void;
}

/** Fila de dato de la sección técnica. */
function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 last:border-0">
      <dt className="text-[11px] text-content-muted">{etiqueta}</dt>
      <dd className="text-right text-xs text-content">{children}</dd>
    </div>
  );
}

/** Tarjeta de dato principal del detalle. */
function TarjetaDato({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary px-3 py-2.5">
      <span className="block text-[10px] uppercase tracking-[0.04em] text-content-muted">{etiqueta}</span>
      <b className="mt-0.5 block text-[15px] font-semibold leading-snug text-content">{valor}</b>
      {detalle && <span className="mt-0.5 block text-[11px] text-content-muted">{detalle}</span>}
    </div>
  );
}

const btnNav =
  "inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-content-secondary transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-40";

/** Detalle del evento: mapa (pendiente), tarjetas de datos, procedencia y nota de alcance. */
export default function DetalleEventoModal({
  evento,
  posicion,
  total,
  hayAnterior,
  haySiguiente,
  onCerrar,
  onAnterior,
  onSiguiente,
}: DetalleEventoModalProps) {
  const [copiado, setCopiado] = useState(false);
  const [copiadoCoord, setCopiadoCoord] = useState(false);

  const copiarHash = async () => {
    const ok = await copyText(evento.originHash);
    if (ok) {
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    }
  };

  const copiarCoords = async () => {
    const ok = await copyText(`${evento.latitude.toFixed(4)}, ${evento.longitude.toFixed(4)}`);
    if (ok) {
      setCopiadoCoord(true);
      window.setTimeout(() => setCopiadoCoord(false), 2000);
    }
  };

  const pie = (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onAnterior} disabled={!hayAnterior} className={btnNav}>
        <IconChevronLeft size={13} />
        Evento anterior
      </button>
      <button type="button" onClick={onSiguiente} disabled={!haySiguiente} className={btnNav}>
        Evento siguiente
        <IconChevronRight size={13} />
      </button>
      <span className="ml-auto text-content-muted" aria-live="polite">
        {posicion} / {total}
      </span>
    </div>
  );

  return (
    <ExpandModal title="Detalle del evento" onClose={onCerrar} footer={pie} resizable>
      <div className="grid grid-cols-1 gap-5">
        <p className="flex items-center gap-1.5 text-xs text-content-muted">
          <IconMapPin size={13} />
          Coordenadas: {evento.latitude.toFixed(4)}, {evento.longitude.toFixed(4)} (lat, lon) · referencia aproximada
        </p>

        <div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <TarjetaDato
              etiqueta="Magnitud"
              valor={`${evento.magnitude.toFixed(1)}${evento.magnitudeType ? ` ${evento.magnitudeType}` : ""}`}
              detalle={`Tipo: ${evento.magnitudeType ?? "No informado por la fuente"}`}
            />
            <TarjetaDato
              etiqueta="Profundidad"
              valor={evento.depthKm != null ? `${evento.depthKm} km` : "—"}
              detalle="Del hipocentro a la superficie"
            />
            <TarjetaDato
              etiqueta="Fecha y hora (UTC-5)"
              valor={fmtDateTimeUTC5(evento.occurredAtUtc)}
              detalle={`${evento.occurredAtUtc} (UTC)`}
            />
            <TarjetaDato
              etiqueta="Estado"
              valor={ETIQUETA_ESTADO[evento.reviewStatus]}
              detalle={
                evento.reviewStatus === "pendiente_validacion"
                  ? "Aún no confirmado por el proveedor"
                  : "Registro observado"
              }
            />
            <TarjetaDato etiqueta="Región" valor={evento.region} />
            <TarjetaDato etiqueta="Localidad" valor={evento.locality} detalle="Referencia aproximada" />
          </div>

          <p
            role="note"
            className="mt-3 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2 text-[11px] leading-relaxed text-content-secondary"
          >
            Evento observado reportado por la fuente. No es una alerta oficial ni una predicción.
          </p>
        </div>
      </div>

      {/* Procedencia y datos técnicos (cerrado por defecto) */}
      <details className="group mt-5 rounded-lg border border-border bg-surface-secondary">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-content">
          <IconChevronRight size={14} className="transition-transform group-open:rotate-90" />
          Procedencia y datos técnicos
        </summary>
        <div className="border-t border-border px-3.5 py-1.5">
          <dl>
            <Dato etiqueta="ID interno">{evento.id}</Dato>
            <Dato etiqueta="ID externo">{evento.externalId}</Dato>
            <Dato etiqueta="Fecha del evento (UTC)">
              <span title={`${evento.occurredAtUtc} (UTC)`}>{evento.occurredAtUtc}</span>
            </Dato>
            <Dato etiqueta="Coordenadas">
              <span className="inline-flex items-center gap-2">
                <code className="font-mono text-[11px]">
                  {evento.latitude.toFixed(4)}, {evento.longitude.toFixed(4)}
                </code>
                <button
                  type="button"
                  onClick={copiarCoords}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-content-secondary transition-colors hover:bg-surface"
                >
                  {copiadoCoord && <IconCheck size={12} />}
                  {copiadoCoord ? "Copiado" : "Copiar"}
                </button>
              </span>
            </Dato>
            <Dato etiqueta="Proveedor">{SOURCE_NAME}</Dato>
            <Dato etiqueta="URL de la fuente">
              <a
                href={evento.sourceUrl || SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-600 hover:underline"
              >
                {evento.sourceUrl || SOURCE_URL}
              </a>
            </Dato>
            <Dato etiqueta="Fecha de recepción (UTC-5)">{fmtDateTimeUTC5(evento.receivedAtUtc)}</Dato>
            <Dato etiqueta="Hash de origen">
              <span className="inline-flex items-center gap-2">
                <code title={evento.originHash} className="font-mono text-[11px]">
                  {evento.originHash.slice(0, 10)}…
                </code>
                <button
                  type="button"
                  onClick={copiarHash}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-content-secondary transition-colors hover:bg-surface"
                >
                  {copiado && <IconCheck size={12} />}
                  {copiado ? "Copiado" : "Copiar"}
                </button>
              </span>
            </Dato>
          </dl>
        </div>
      </details>
    </ExpandModal>
  );
}
