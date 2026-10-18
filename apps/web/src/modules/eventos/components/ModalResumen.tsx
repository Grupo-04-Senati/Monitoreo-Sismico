import { useMemo } from "react";
import type { EventoSismico, ResumenEventos, SeccionResumen } from "../types";
import { ETIQUETA_ESTADO, ETIQUETA_TIPO } from "../schemas/filtros.schema";
import { fmtDateTimeUTC5 } from "@/lib/format";
import ExpandModal from "@/components/ui/ExpandModal";
import { IconCheck, IconInfo } from "@/components/ui/Icons";

interface ModalResumenProps {
  seccion: SeccionResumen;
  /** Eventos que cumplen los filtros activos (toda la selección, no la página). */
  eventos: EventoSismico[];
  resumen: ResumenEventos | null;
  onCerrar: () => void;
}

const TITULOS: Record<SeccionResumen, string> = {
  eventos: "Eventos",
  magnitud: "Magnitud máxima",
  profundidad: "Profundidad mediana",
  pendientes: "Pendientes de validación",
  sinTipo: "Sin tipo de magnitud",
};

const pct = (parte: number, total: number) => (total > 0 ? `${((parte / total) * 100).toFixed(1)}%` : "—");

/** Fila de una barra proporcional (conteo simple sobre la selección). */
function Barra({ etiqueta, n, total }: { etiqueta: string; n: number; total: number }) {
  const ancho = total > 0 ? Math.round((n / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="w-32 shrink-0 text-[11px] text-content-muted">{etiqueta}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-tertiary">
        <div className="h-full rounded-full bg-accent-600" style={{ width: `${ancho}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right text-[11px] text-content-secondary">
        {n} · {pct(n, total)}
      </span>
    </div>
  );
}

const FILA = "grid gap-2 border-b border-border px-1 py-1.5 text-xs last:border-0";
const COLS = "[grid-template-columns:7rem_1fr_5rem]";

/** Lista compacta de eventos (fecha · localidad · magnitud). */
function Lista({ eventos }: { eventos: EventoSismico[] }) {
  if (eventos.length === 0) {
    return <p className="rounded-lg border border-border bg-surface-secondary px-3.5 py-3 text-xs text-content-muted">Sin eventos en la selección.</p>;
  }
  return (
    <div className="rounded-lg border border-border">
      <div className={`${FILA} ${COLS} bg-surface-secondary font-medium text-content-muted`}>
        <span>Fecha (UTC-5)</span>
        <span>Localidad</span>
        <span className="text-right">Magnitud</span>
      </div>
      {eventos.map((e) => (
        <div key={e.id} className={`${FILA} ${COLS} text-content-secondary`}>
          <span>{fmtDateTimeUTC5(e.occurredAtUtc)}</span>
          <span className="truncate" title={`${e.locality} · ${e.region}`}>
            {e.locality}
          </span>
          <span className="text-right text-content">
            {e.magnitude.toFixed(1)} {e.magnitudeType ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}

const BANDAS: { label: string; min: number; max: number }[] = [
  { label: "0–30 km", min: 0, max: 30 },
  { label: "30–70 km", min: 30, max: 70 },
  { label: "70–150 km", min: 70, max: 150 },
  { label: "150–300 km", min: 150, max: 300 },
  { label: "> 300 km", min: 300, max: Number.POSITIVE_INFINITY },
];

/** Detalle del resumen: explica cada tarjeta con desglose o listado. */
export default function ModalResumen({ seccion, eventos, resumen, onCerrar }: ModalResumenProps) {
  const total = eventos.length;

  const contenido = useMemo(() => {
    switch (seccion) {
      case "eventos": {
        const observados = eventos.filter((e) => e.reviewStatus === "observado").length;
        const pendientes = total - observados;
        const porTipo = ["Mw", "ML", "mb", "none"].map((t) => ({
          key: t,
          label: ETIQUETA_TIPO[t as keyof typeof ETIQUETA_TIPO],
          n: eventos.filter((e) => (t === "none" ? e.magnitudeType === null : e.magnitudeType === t)).length,
        }));
        return (
          <>
            <section>
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-content-muted">Por estado de revisión</h4>
              <Barra etiqueta={ETIQUETA_ESTADO.observado} n={observados} total={total} />
              <Barra etiqueta={ETIQUETA_ESTADO.pendiente_validacion} n={pendientes} total={total} />
            </section>
            <section className="mt-4">
              <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-content-muted">Por tipo de magnitud</h4>
              {porTipo.map((t) => (
                <Barra key={t.key} etiqueta={t.label} n={t.n} total={total} />
              ))}
            </section>
          </>
        );
      }

      case "magnitud": {
        const max = resumen?.magnitudMaxima ?? null;
        const top = [...eventos].sort((a, b) => b.magnitude - a.magnitude).slice(0, 10);
        return (
          <>
            {max && (
              <p className="mb-3 text-xs text-content-secondary">
                Mayor del periodo: <b className="font-semibold text-content">{max.magnitude.toFixed(1)} {max.magnitudeType ?? ""}</b> — {max.locality} · {max.region} ({fmtDateTimeUTC5(max.occurredAtUtc)}).
              </p>
            )}
            <Lista eventos={top} />
            {total > top.length && <p className="mt-2 text-[11px] text-content-muted">Mostrando los {top.length} de mayor magnitud.</p>}
          </>
        );
      }

      case "profundidad": {
        const prof = resumen?.profundidad ?? null;
        return (
          <>
            {prof && (
              <p className="mb-3 text-xs text-content-secondary">
                Mínima <b className="font-semibold text-content">{prof.min} km</b> · mediana{" "}
                <b className="font-semibold text-content">{prof.mediana} km</b> · máxima{" "}
                <b className="font-semibold text-content">{prof.max} km</b>.
              </p>
            )}
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-content-muted">Distribución por bandas</h4>
            {BANDAS.map((b) => (
              <Barra
                key={b.label}
                etiqueta={b.label}
                n={eventos.filter((e) => e.depthKm != null && e.depthKm >= b.min && e.depthKm < b.max).length}
                total={total}
              />
            ))}
          </>
        );
      }

      case "pendientes": {
        const pendientes = [...eventos]
          .filter((e) => e.reviewStatus === "pendiente_validacion")
          .sort((a, b) => b.occurredAtUtc.localeCompare(a.occurredAtUtc));
        return (
          <>
            <p className="mb-3 text-xs text-content-secondary">
              {pendientes.length === 0
                ? "Ningún evento de la selección está pendiente de validación."
                : `${pendientes.length} evento(s) aún no confirmados por el proveedor. Los datos pueden corregirse.`}
            </p>
            <Lista eventos={pendientes} />
          </>
        );
      }

      case "sinTipo": {
        const sinTipo = [...eventos]
          .filter((e) => e.magnitudeType === null)
          .sort((a, b) => b.occurredAtUtc.localeCompare(a.occurredAtUtc));
        return (
          <>
            <p className="mb-3 text-xs text-content-secondary">
              {sinTipo.length === 0
                ? "Todos los eventos de la selección tienen tipo de magnitud informado."
                : `${sinTipo.length} evento(s) sin tipo de magnitud informado por la fuente.`}
            </p>
            <Lista eventos={sinTipo} />
          </>
        );
      }

      default:
        return null;
    }
  }, [seccion, eventos, resumen, total]);

  const pie = (
    <div className="flex items-center gap-2">
      <span className="text-content-muted">n = {total.toLocaleString("es-PE")} en la selección actual</span>
      <button
        type="button"
        onClick={onCerrar}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500"
      >
        <IconCheck size={13} />
        Entendido
      </button>
    </div>
  );

  return (
    <ExpandModal title={`Detalle · ${TITULOS[seccion]}`} onClose={onCerrar} footer={pie} resizable>
      <p
        role="note"
        className="mb-4 flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2 text-[11px] leading-relaxed text-content-secondary"
      >
        <IconInfo size={13} className="mt-0.5 shrink-0" />
        <span>
          Desglose calculado sobre los eventos que cumplen los filtros activos. Los eventos observados pueden ser
          revisados o corregidos por el proveedor.
        </span>
      </p>
      {contenido}
    </ExpandModal>
  );
}
