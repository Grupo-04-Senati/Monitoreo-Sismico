import type { Regla } from "../types";
import { ETIQUETA_CANAL, fmtEspera, resumenCondicion, resumenZona } from "../schemas/alertas.schema";
import { InsigniaRegla, InsigniaSeveridad } from "./Insignias";

interface TablaReglasProps {
  reglas: Regla[] | null;
  cargando: boolean;
  onAbrir: (r: Regla) => void;
}

/** Lista de reglas. Clic en una fila abre su ficha. */
export default function TablaReglas({ reglas, cargando, onAbrir }: TablaReglasProps) {
  if (cargando && !reglas) return <div className="py-10 text-center text-sm text-content-muted">Cargando reglas…</div>;
  if (!reglas) return null;
  if (reglas.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface py-12 text-center">
        <p className="text-sm font-medium text-content">Aún no hay reglas</p>
        <p className="mt-0.5 text-xs text-content-muted">Crea la primera, simúlala y pide a un Administrador que la active.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <caption className="sr-only">Reglas de aviso</caption>
        <thead>
          <tr className="border-b border-border bg-surface-secondary">
            {["Regla", "Condición", "Zona", "Severidad", "Canales", "Espera", "Aprobación", "Estado"].map((h) => (
              <th key={h} scope="col" className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-content-secondary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reglas.map((r) => (
            <tr
              key={r.id}
              tabIndex={0}
              role="button"
              onClick={() => onAbrir(r)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  onAbrir(r);
                }
              }}
              className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-surface-tertiary focus:bg-surface-tertiary focus:outline-none"
            >
              <td className="px-3 py-2.5 font-medium text-content">{r.name}</td>
              <td className="px-3 py-2.5 text-xs text-content-secondary">{resumenCondicion(r.condition_json)}</td>
              <td className="px-3 py-2.5 text-xs text-content-secondary">{resumenZona(r.zone_spec)}</td>
              <td className="px-3 py-2.5"><InsigniaSeveridad severidad={r.severity} /></td>
              <td className="px-3 py-2.5 text-xs text-content-secondary">{r.channels.map((c) => ETIQUETA_CANAL[c]).join(" + ")}</td>
              <td className="px-3 py-2.5 text-xs text-content-secondary">{fmtEspera(r.cooldown_seconds)}</td>
              <td className="px-3 py-2.5 text-xs text-content-secondary">{r.requires_approval ? "Manual" : "Automática"}</td>
              <td className="px-3 py-2.5"><InsigniaRegla activa={r.enabled} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
