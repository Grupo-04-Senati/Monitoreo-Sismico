import type { ConectorFuente } from "../types";
import { fmtDateTimeUTC5 } from "@/lib/format";
import { IconExpand, IconShield } from "@/components/ui/Icons";

interface Item {
  etiqueta: string;
  valor: string;
  pendiente?: boolean;
  nodo?: React.ReactNode;
}

/** Ficha técnica del conector con el proveedor (datos de la fuente). */
export default function FichaConector({ ficha, onExpandir }: { ficha: ConectorFuente; onExpandir?: () => void }) {
  const items: Item[] = [
    { etiqueta: "Nombre", valor: ficha.nombre },
    { etiqueta: "Organización", valor: ficha.organizacion },
    { etiqueta: "Tipo", valor: ficha.tipo },
    { etiqueta: "Frecuencia", valor: ficha.frecuencia },
    { etiqueta: "Última ejecución", valor: `${fmtDateTimeUTC5(ficha.ultimaEjecucionUtc)} (UTC-5)` },
    { etiqueta: "Último éxito", valor: `${fmtDateTimeUTC5(ficha.ultimoExitoUtc)} (UTC-5)` },
    { etiqueta: "Latencia media", valor: `${ficha.latenciaMs} ms` },
    {
      etiqueta: "URL / API",
      valor: ficha.urlApi,
      nodo: (
        <a href={ficha.urlApi} target="_blank" rel="noopener noreferrer" className="text-accent-600 hover:underline">
          {ficha.urlApi}
        </a>
      ),
    },
    { etiqueta: "Límites de uso", valor: ficha.limitesUso ?? "pendiente", pendiente: !ficha.limitesUso },
    { etiqueta: "Licencia", valor: ficha.licencia ?? "pendiente", pendiente: !ficha.licencia },
    { etiqueta: "Contacto", valor: ficha.contacto ?? "pendiente", pendiente: !ficha.contacto },
  ];

  return (
    <section
      aria-label="Ficha del conector"
      className="auth-surface tilt mb-3 rounded-lg border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-accent-500 hover:shadow-md"
    >
      <div className="mb-2.5 flex items-center gap-2">
        <IconShield size={15} className="text-accent-600" />
        <h2 className="text-sm font-semibold text-content">Ficha del conector</h2>
        {onExpandir && (
          <button
            type="button"
            onClick={onExpandir}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-content-secondary transition-colors hover:bg-surface-tertiary"
          >
            <IconExpand size={13} />
            Pantalla completa
          </button>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.etiqueta} className="flex items-baseline justify-between gap-3 border-b border-border py-1.5">
            <dt className="shrink-0 text-[11px] text-content-muted">{it.etiqueta}</dt>
            <dd
              className={`truncate text-right text-xs ${
                it.pendiente ? "italic text-content-muted" : "font-medium text-content-secondary"
              }`}
              title={it.valor}
            >
              {it.nodo ?? it.valor}
            </dd>
          </div>
        ))}

        <div className="flex items-baseline justify-between gap-3 border-b border-border py-1.5">
          <dt className="shrink-0 text-[11px] text-content-muted">Credenciales</dt>
          <dd className="flex items-center gap-1.5 text-xs text-content-secondary">
            <code className="font-mono text-[11px] text-content">{ficha.credencialRef}</code>
            <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-content-muted">
              valor oculto
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
