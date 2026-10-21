import { Link } from "react-router-dom";
import ExpandModal from "@/components/ui/ExpandModal";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { Regla } from "../types";
import { ETIQUETA_CANAL, fmtEspera, reglaInDesdeRegla, resumenCondicion, resumenZona } from "../schemas/alertas.schema";
import { InsigniaRegla, InsigniaSeveridad } from "./Insignias";
import PanelSimulacion from "./PanelSimulacion";

interface DetalleReglaModalProps {
  regla: Regla;
  esAdmin: boolean;
  cambiando: boolean;
  onActivar: (r: Regla, activar: boolean) => void;
  onEditar: (r: Regla) => void;
  onCerrar: () => void;
}

/** Ficha de una regla con su simulación y las acciones según el rol. */
export default function DetalleReglaModal({ regla: r, esAdmin, cambiando, onActivar, onEditar, onCerrar }: DetalleReglaModalProps) {
  const ficha: [string, string][] = [
    ["Condición", resumenCondicion(r.condition_json)],
    ["Zona", resumenZona(r.zone_spec)],
    ["Canales", r.channels.map((c) => ETIQUETA_CANAL[c]).join(" + ")],
    ["Destinatarios de correo", r.recipients.length ? r.recipients.join(", ") : "—"],
    ["Espera entre avisos", fmtEspera(r.cooldown_seconds)],
    ["Antigüedad máxima del sismo", `${r.max_event_age_hours} h`],
    ["Aprobación de cada aviso", r.requires_approval ? "Sí, antes de enviar" : "No: se entrega al llegar el sismo"],
    ["Plantilla del título", r.title_template],
    ["Plantilla del mensaje", r.message_template],
    ["Creada", fmtDateTimeUTC5(r.created_at)],
    ["Activada", r.approved_at ? fmtDateTimeUTC5(r.approved_at) : "—"],
  ];

  const pie = (
    <div className="flex flex-wrap items-center gap-2">
      <InsigniaRegla activa={r.enabled} />
      <span className="text-content-muted">
        {r.enabled
          ? "Para editarla, desactívala primero; luego necesitará otra activación."
          : esAdmin
            ? "Al activarla quedas como su aprobador."
            : "Solo un Administrador puede activarla."}
      </span>
      {!r.enabled && (
        <button
          type="button"
          onClick={() => onEditar(r)}
          className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs font-medium text-content transition-colors hover:bg-surface-tertiary"
        >
          Editar
        </button>
      )}
      {r.enabled ? (
        <button
          type="button"
          onClick={() => onActivar(r, false)}
          disabled={cambiando}
          className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs font-medium text-content transition-colors hover:bg-surface-tertiary disabled:opacity-40"
        >
          Desactivar
        </button>
      ) : (
        esAdmin && (
          <button
            type="button"
            onClick={() => onActivar(r, true)}
            disabled={cambiando}
            className="rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:opacity-40"
          >
            Activar
          </button>
        )
      )}
    </div>
  );

  return (
    <ExpandModal title={`Regla · ${r.name}`} onClose={onCerrar} footer={pie} resizable>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <InsigniaSeveridad severidad={r.severity} />
          {r.description && <p className="text-xs text-content-secondary">{r.description}</p>}
          <Link
            to={`/alertas?regla=${encodeURIComponent(r.id)}`}
            className="ml-auto text-xs font-medium text-accent-700 underline dark:text-accent-300"
          >
            Ver sus avisos
          </Link>
        </div>

        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
          {ficha.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-content-secondary">{k}</dt>
              <dd className="break-words font-medium text-content">{v}</dd>
            </div>
          ))}
        </dl>

        <PanelSimulacion regla={reglaInDesdeRegla(r)} />
      </div>
    </ExpandModal>
  );
}
