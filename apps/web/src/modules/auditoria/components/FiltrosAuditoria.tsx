import type { Facetas, FiltrosAuditoria as Filtros } from "../types";
import { FILTROS_VACIOS, etiquetaAccion, etiquetaEntidad } from "../schemas/auditoria.schema";

const campoCls = "rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none";
const etiquetaCls = "text-[11px] font-medium text-content-secondary";

interface FiltrosAuditoriaProps {
  filtros: Filtros;
  facetas: Facetas | null;
  onCambiar: (patch: Partial<Filtros>) => void;
}

/** Filtros de la bitácora: usuario, acción, entidad, id y rango de días (UTC-5). */
export default function FiltrosAuditoria({ filtros: f, facetas, onCambiar }: FiltrosAuditoriaProps) {
  const activos = Object.values(f).some(Boolean);
  const rangoInvalido = !!(f.desde && f.hasta && f.desde > f.hasta);

  return (
    <div className="mb-3 rounded-lg border border-border bg-surface p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className={etiquetaCls}>Usuario</span>
          <select value={f.actor_id} onChange={(e) => onCambiar({ actor_id: e.target.value })} className={campoCls}>
            <option value="">Todos</option>
            {facetas?.actores.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre ? `${a.nombre} · ${a.email}` : `Cuenta eliminada (${a.id.slice(0, 8)}…)`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiquetaCls}>Acción</span>
          <select value={f.action} onChange={(e) => onCambiar({ action: e.target.value })} className={campoCls}>
            <option value="">Todas</option>
            {facetas?.acciones.map((a) => (
              <option key={a} value={a}>{etiquetaAccion(a)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiquetaCls}>Entidad</span>
          <select value={f.entity_type} onChange={(e) => onCambiar({ entity_type: e.target.value })} className={campoCls}>
            <option value="">Todas</option>
            {facetas?.entidades.map((e) => (
              <option key={e} value={e}>{etiquetaEntidad(e)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiquetaCls}>Desde (UTC-5)</span>
          <input type="date" value={f.desde} max={f.hasta || undefined} onChange={(e) => onCambiar({ desde: e.target.value })} className={campoCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={etiquetaCls}>Hasta (UTC-5)</span>
          <input type="date" value={f.hasta} min={f.desde || undefined} onChange={(e) => onCambiar({ hasta: e.target.value })} className={campoCls} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[260px] flex-1 flex-col gap-1">
          <span className={etiquetaCls}>ID de la entidad (exacto)</span>
          <input
            value={f.entity_id}
            onChange={(e) => onCambiar({ entity_id: e.target.value })}
            maxLength={64}
            placeholder="p. ej. el id de una regla o de un usuario"
            className={campoCls}
          />
        </label>
        {activos && (
          <button
            type="button"
            onClick={() => onCambiar(FILTROS_VACIOS)}
            className="text-xs font-medium text-accent-700 underline dark:text-accent-300"
          >
            Quitar filtros
          </button>
        )}
      </div>
      {rangoInvalido && <p className="mt-2 text-[11px] text-content-secondary">La fecha inicial es posterior a la final.</p>}
    </div>
  );
}
