import { useState } from "react";
import ExpandModal from "@/components/ui/ExpandModal";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { Aviso } from "../types";
import type { AccionAviso } from "../services/alertas.service";
import { ETIQUETA_CANAL, ETIQUETA_ENTREGA, fmtKm, fmtMagnitud } from "../schemas/alertas.schema";
import { InsigniaEstado, InsigniaSeveridad } from "./Insignias";

interface DetalleAvisoModalProps {
  aviso: Aviso;
  ocupado: boolean;
  onAccion: (a: Aviso, accion: AccionAviso) => void;
  onCancelar: (a: Aviso, motivo: string) => void;
  onCerrar: () => void;
}

const botonSecundario =
  "rounded-md border border-border px-3 py-1.5 text-xs font-medium text-content transition-colors hover:bg-surface-tertiary disabled:opacity-40";
const botonPrimario =
  "rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:opacity-40";

/** Detalle de un aviso: sismo, mensaje, entregas, historial y acciones según su estado. */
export default function DetalleAvisoModal({ aviso: a, ocupado, onAccion, onCancelar, onCerrar }: DetalleAvisoModalProps) {
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const puedeAprobar = a.status === "pendiente_aprobacion";
  const puedeReintentar = a.status === "fallida";
  const puedeAcusar = (a.status === "enviada" || a.status === "fallida") && !a.acknowledged_at;
  const puedeCancelar = a.status === "pendiente_aprobacion" || a.status === "aprobada" || a.status === "fallida";
  const e = a.evento;

  const sismo: [string, string][] = e
    ? [
        ["Magnitud", fmtMagnitud(e.magnitude, e.magnitude_type)],
        ["Lugar", e.locality ?? "—"],
        ["Fecha (UTC-5)", fmtDateTimeUTC5(e.occurred_at)],
        ["Profundidad", fmtKm(e.depth_km)],
        ["Coordenadas", `${e.latitude.toFixed(3)}, ${e.longitude.toFixed(3)}`],
        ["Distancia a la zona", fmtKm(a.distance_km)],
      ]
    : [["Sismo", "No disponible"]];

  const historial: [string, string | null][] = [
    ["Generado", a.created_at],
    ["Aprobado", a.approved_at],
    ["Cancelado", a.cancelled_at],
    ["Acuse de recibo", a.acknowledged_at],
  ];

  const pie = (
    <div className="flex flex-wrap items-center gap-2">
      <InsigniaEstado estado={a.status} />
      {cancelando ? (
        <>
          <input
            autoFocus
            value={motivo}
            onChange={(ev) => setMotivo(ev.target.value)}
            maxLength={300}
            placeholder="Motivo de la cancelación (obligatorio)"
            aria-label="Motivo de la cancelación"
            className="min-w-[220px] flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none"
          />
          <button type="button" onClick={() => setCancelando(false)} className={botonSecundario}>
            Volver
          </button>
          <button
            type="button"
            onClick={() => onCancelar(a, motivo.trim())}
            disabled={ocupado || motivo.trim().length < 3}
            className={botonPrimario}
          >
            Confirmar cancelación
          </button>
        </>
      ) : (
        <>
          <span className="text-content-muted">
            {puedeAprobar
              ? "Revisa el sismo en la fuente antes de aprobar."
              : a.status === "suprimida"
                ? "Suprimido por la espera entre avisos de su regla: no se envió."
                : a.status === "cancelada"
                  ? `Cancelado: ${a.cancel_reason ?? "sin motivo"}`
                  : "Todas las acciones quedan en la Auditoría."}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {puedeCancelar && (
              <button type="button" onClick={() => setCancelando(true)} disabled={ocupado} className={botonSecundario}>
                Cancelar aviso
              </button>
            )}
            {puedeAcusar && (
              <button type="button" onClick={() => onAccion(a, "acknowledge")} disabled={ocupado} className={botonSecundario}>
                Dar acuse de recibo
              </button>
            )}
            {puedeReintentar && (
              <button type="button" onClick={() => onAccion(a, "retry")} disabled={ocupado} className={botonPrimario}>
                Reintentar entregas
              </button>
            )}
            {puedeAprobar && (
              <button type="button" onClick={() => onAccion(a, "approve")} disabled={ocupado} className={botonPrimario}>
                Aprobar y enviar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <ExpandModal title={a.title} onClose={onCerrar} footer={pie} resizable>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-content-secondary">
          <InsigniaSeveridad severidad={a.severity} />
          <span>
            Regla: <b className="font-medium text-content">{a.rule_name ?? "—"}</b>
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Aviso interno · no es alerta oficial
          </span>
        </div>

        <section className="rounded-lg border border-border bg-surface-secondary px-3 py-2.5">
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-content-secondary">Mensaje</h4>
          <p className="whitespace-pre-line text-xs leading-relaxed text-content">{a.message}</p>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-content-secondary">Sismo observado</h4>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
              {sismo.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-content-secondary">{k}</dt>
                  <dd className="break-words font-medium text-content">{v}</dd>
                </div>
              ))}
            </dl>
            {a.source_url && (
              <a
                href={a.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-medium text-accent-700 underline dark:text-accent-300"
              >
                Ver el evento en la fuente (USGS) ↗
              </a>
            )}
          </section>

          <section>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-content-secondary">Historial (UTC-5)</h4>
            <ol className="space-y-1.5 text-xs">
              {historial.map(([k, v]) => (
                <li key={k} className={`flex gap-2 ${v ? "text-content" : "text-content-muted"}`}>
                  <span aria-hidden="true">{v ? "●" : "○"}</span>
                  <span className="w-28 text-content-secondary">{k}</span>
                  <span className="font-medium">{v ? fmtDateTimeUTC5(v) : "—"}</span>
                </li>
              ))}
            </ol>
            {a.cancel_reason && <p className="mt-2 text-[11px] text-content-secondary">Motivo: {a.cancel_reason}</p>}
          </section>
        </div>

        <section>
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-content-secondary">Entregas</h4>
          {a.entregas.length === 0 ? (
            <p className="text-xs text-content-muted">
              {a.status === "pendiente_aprobacion" ? "Se harán al aprobar el aviso." : "Este aviso no tuvo entregas."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <caption className="sr-only">Entregas del aviso</caption>
                <thead className="bg-surface-secondary">
                  <tr>
                    {["Canal", "Destino", "Resultado", "Intentos", "Último intento", "Detalle"].map((h) => (
                      <th key={h} scope="col" className="px-2.5 py-1.5 text-left text-[11px] font-semibold text-content-secondary">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {a.entregas.map((d) => (
                    <tr key={d.id} className="border-t border-border">
                      <td className="px-2.5 py-1.5 text-content">{ETIQUETA_CANAL[d.channel]}</td>
                      <td className="px-2.5 py-1.5 text-content-secondary">{d.destino_etiqueta ?? d.destination}</td>
                      <td className={`px-2.5 py-1.5 ${d.status === "fallida" ? "font-semibold text-content" : "text-content-secondary"}`}>
                        {ETIQUETA_ENTREGA[d.status]}
                      </td>
                      <td className="px-2.5 py-1.5 text-content-secondary">{d.attempts}</td>
                      <td className="whitespace-nowrap px-2.5 py-1.5 text-content-secondary">
                        {d.last_attempt_at ? fmtDateTimeUTC5(d.last_attempt_at) : "—"}
                      </td>
                      <td className="px-2.5 py-1.5 text-content-secondary">{d.error ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </ExpandModal>
  );
}
