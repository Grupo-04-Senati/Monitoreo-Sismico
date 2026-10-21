import { useState } from "react";
import { Link } from "react-router";
import Card from "@/components/ui/Card";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { Retencion } from "../types";

interface PanelRetencionProps {
  retencion: Retencion | null;
  purgando: boolean;
  onPurgar: () => void;
}

const PALABRA = "PURGAR";

/** Vista previa de la retención y purga manual con confirmación escrita. */
export default function PanelRetencion({ retencion: r, purgando, onPurgar }: PanelRetencionProps) {
  const [confirmando, setConfirmando] = useState(false);
  const [palabra, setPalabra] = useState("");

  if (!r) return <Card title="Retención de la auditoría"><p className="text-xs text-content-muted">Cargando…</p></Card>;

  const cifras: [string, string][] = [
    ["Registros en total", r.total.toLocaleString("es-PE")],
    ["Más antiguos que la retención", r.a_purgar.toLocaleString("es-PE")],
    ["Fecha de corte (UTC-5)", fmtDateTimeUTC5(r.corte)],
    ["Registro más antiguo", r.mas_antiguo ? fmtDateTimeUTC5(r.mas_antiguo) : "—"],
  ];

  return (
    <Card
      title="Retención de la auditoría"
      help="La purga es manual y queda registrada. La base de datos rechaza borrar registros de menos de 365 días."
    >
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cifras.map(([k, v]) => (
          <div key={k} className="rounded-md border border-border bg-surface-secondary px-2.5 py-2">
            <dt className="text-[10px] uppercase tracking-wide text-content-muted">{k}</dt>
            <dd className="text-sm font-semibold text-content">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-content-secondary">
        Retención vigente: <b className="font-medium text-content">{r.retencion_dias} días</b> (mínimo {r.minimo_dias}). Antes de
        purgar conviene{" "}
        <Link to="/auditoria" className="underline">exportar la auditoría</Link> si la política de la empresa lo exige.
      </p>

      {r.a_purgar === 0 ? (
        <p className="mt-3 text-xs text-content-muted">No hay registros más antiguos que la retención: no hay nada que purgar.</p>
      ) : confirmando ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-slate-500 p-2.5">
          <span className="text-xs text-content">
            Se borrarán <b>{r.a_purgar.toLocaleString("es-PE")}</b> registros de forma definitiva. Escribe {PALABRA} para confirmar:
          </span>
          <input
            autoFocus
            value={palabra}
            onChange={(e) => setPalabra(e.target.value)}
            aria-label={`Escribe ${PALABRA} para confirmar`}
            className="w-28 rounded-md border border-border bg-surface px-2 py-1 text-xs text-content"
          />
          <button
            type="button"
            onClick={() => {
              setConfirmando(false);
              setPalabra("");
            }}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-content hover:bg-surface-tertiary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onPurgar}
            disabled={palabra !== PALABRA || purgando}
            className="rounded-md bg-slate-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-600 disabled:opacity-40 dark:bg-slate-200 dark:text-slate-900"
          >
            {purgando ? "Purgando…" : "Purgar definitivamente"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-content transition-colors hover:bg-surface-tertiary"
        >
          Purgar {r.a_purgar.toLocaleString("es-PE")} registros…
        </button>
      )}
    </Card>
  );
}
