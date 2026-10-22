import type { Procedencia } from "../services/eventos.service";
import { fmtDateTimeUTC5 } from "@/lib/format";

/** Franja de procedencia: fuente, sincronización, licencia y rango del catálogo. */
export default function FranjaProcedencia({ procedencia }: { procedencia: Procedencia }) {
  const items: { etiqueta: string; valor: string; pendiente?: boolean }[] = [
    { etiqueta: "Fuente", valor: procedencia.fuente },
    { etiqueta: "Última sincronización", valor: `${fmtDateTimeUTC5(procedencia.ultimaSincronizacion)} (UTC-5)` },
    { etiqueta: "Licencia", valor: procedencia.licencia ?? "pendiente", pendiente: !procedencia.licencia },
    { etiqueta: "Catálogo", valor: procedencia.rangoCatalogo },
  ];

  return (
    <dl
      aria-label="Procedencia de los datos"
      className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-[10px] border border-border bg-surface-secondary px-3.5 py-2"
    >
      {items.map((it) => (
        <div key={it.etiqueta} className="flex items-baseline gap-1.5 text-[11px]">
          <dt className="text-content-muted">{it.etiqueta}:</dt>
          <dd className={it.pendiente ? "italic text-content-muted" : "font-medium text-content-secondary"}>{it.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
