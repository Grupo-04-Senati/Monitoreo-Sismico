import { Link } from "react-router";
import Card from "@/components/ui/Card";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { Cambio } from "../types";

function describir(c: Cambio): string {
  if (c.accion === "auditoria_purgada") {
    const borrados = c.despues?.borrados;
    return `Purga de auditoría: ${typeof borrados === "number" ? borrados.toLocaleString("es-PE") : "—"} registros borrados`;
  }
  const antes = c.antes?.valor ?? "—";
  const despues = c.despues?.valor ?? "—";
  return `${c.etiqueta ?? c.clave ?? "Parámetro"}: ${String(antes)} → ${String(despues)}`;
}

/** Control de cambios: lo saca de la auditoría (no se puede alterar). */
export default function HistorialCambios({ cambios }: { cambios: Cambio[] | null }) {
  return (
    <Card
      title="Control de cambios"
      help="Cambios de parámetros y purgas, tomados de la auditoría protegida."
      action={
        <Link to="/auditoria?entity_type=system_setting" className="text-xs font-medium text-accent-700 underline dark:text-accent-300">
          Ver en Auditoría
        </Link>
      }
    >
      {cambios === null ? (
        <p className="text-xs text-content-muted">Cargando…</p>
      ) : cambios.length === 0 ? (
        <p className="text-xs text-content-muted">Aún no hay cambios: todos los parámetros tienen su valor por defecto.</p>
      ) : (
        <ol className="space-y-2">
          {cambios.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline gap-x-2 border-b border-border pb-2 text-xs last:border-0 last:pb-0">
              <span className="whitespace-nowrap text-content-muted">{fmtDateTimeUTC5(c.fecha)}</span>
              <span className="font-medium text-content">{describir(c)}</span>
              <span className="text-content-secondary">· {c.actor ?? "Cuenta eliminada"}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
