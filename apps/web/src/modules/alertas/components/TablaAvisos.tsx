import { fmtDateTimeUTC5 } from "@/lib/format";
import Paginador from "@/modules/reportes/components/Paginador";
import type { Aviso, PaginaAvisos } from "../types";
import { ETIQUETA_CANAL, ETIQUETA_ENTREGA, fmtKm, fmtMagnitud } from "../schemas/alertas.schema";
import { InsigniaEstado, InsigniaSeveridad } from "./Insignias";

interface TablaAvisosProps {
  datos: PaginaAvisos | null;
  cargando: boolean;
  filtrado: boolean;
  onAbrir: (a: Aviso) => void;
  onPagina: (n: number) => void;
}

function resumenEntregas(a: Aviso): string {
  if (a.entregas.length === 0) return a.status === "pendiente_aprobacion" ? "Esperan aprobación" : "—";
  return a.entregas.map((e) => `${ETIQUETA_CANAL[e.channel]}: ${ETIQUETA_ENTREGA[e.status].split(" ")[0].toLowerCase()}`).join(" · ");
}

/** Lista de avisos (más recientes primero). Clic en una fila abre el detalle. */
export default function TablaAvisos({ datos, cargando, filtrado, onAbrir, onPagina }: TablaAvisosProps) {
  if (cargando && !datos) return <div className="py-10 text-center text-sm text-content-muted">Cargando avisos…</div>;
  if (!datos) return null;
  if (datos.items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface py-12 text-center">
        <p className="text-sm font-medium text-content">{filtrado ? "Ningún aviso con estos filtros" : "Aún no hay avisos"}</p>
        <p className="mt-0.5 text-xs text-content-muted">
          {filtrado
            ? "Quita algún filtro para ver más."
            : "Se generan cuando llega un sismo que cumple una regla activa (tras cada sincronización con la fuente)."}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">Avisos internos</caption>
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              {["Generado (UTC-5)", "Sismo (fecha UTC-5)", "Lugar", "Distancia", "Regla", "Severidad", "Estado", "Entregas"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-content-secondary">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.items.map((a) => (
              <tr
                key={a.id}
                tabIndex={0}
                role="button"
                onClick={() => onAbrir(a)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    onAbrir(a);
                  }
                }}
                className="cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-surface-tertiary focus:bg-surface-tertiary focus:outline-none"
              >
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-content-secondary">{fmtDateTimeUTC5(a.created_at)}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="font-semibold text-content">{a.evento ? fmtMagnitud(a.evento.magnitude, a.evento.magnitude_type) : "—"}</span>
                  {a.evento && <span className="block text-[11px] text-content-muted">{fmtDateTimeUTC5(a.evento.occurred_at)}</span>}
                </td>
                <td className="px-3 py-2.5 text-xs text-content-secondary">{a.evento?.locality ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-content-secondary">{fmtKm(a.distance_km)}</td>
                <td className="px-3 py-2.5 text-xs text-content-secondary">{a.rule_name ?? "—"}</td>
                <td className="px-3 py-2.5"><InsigniaSeveridad severidad={a.severity} /></td>
                <td className="px-3 py-2.5">
                  <InsigniaEstado estado={a.status} />
                  {a.acknowledged_at && <span className="ml-1 text-[10px] text-content-muted">✓ acuse</span>}
                </td>
                <td className="px-3 py-2.5 text-[11px] text-content-secondary">{resumenEntregas(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3">
        <Paginador
          total={datos.total}
          pagina={datos.page}
          tamano={datos.page_size}
          totalPaginas={Math.max(1, Math.ceil(datos.total / datos.page_size))}
          unidad="avisos"
          onPagina={onPagina}
        />
      </div>
    </>
  );
}
