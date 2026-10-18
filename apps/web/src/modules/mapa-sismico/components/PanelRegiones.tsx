import type { RegionResumen } from "../types";

interface PanelRegionesProps {
  regiones: RegionResumen[];
  total: number;
  regionActiva: string;
  onRegionClick: (slug: string) => void;
}

/** Tabla lateral con las 25 regiones; clic en una fila filtra el mapa. */
export default function PanelRegiones({ regiones, total, regionActiva, onRegionClick }: PanelRegionesProps) {
  const suma = regiones.reduce((s, r) => s + r.eventos, 0);
  const coincide = suma === total;

  return (
    <section
      aria-label="Resumen por región"
      className="auth-surface flex h-full flex-col rounded-[10px] border border-border bg-surface"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-content">Regiones</h2>
        <span className="text-[11px] text-content-muted">{regiones.length} departamentos</span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-surface-secondary text-[10px] uppercase tracking-wide text-content-muted">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">Región</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Eventos</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">%</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Máx.</th>
            </tr>
          </thead>
          <tbody>
            {regiones.map((r) => {
              const activa = r.slug === regionActiva;
              return (
                <tr
                  key={r.slug}
                  onClick={() => onRegionClick(r.slug)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRegionClick(r.slug);
                    }
                  }}
                  aria-pressed={activa}
                  aria-label={`Filtrar por ${r.nombre}: ${r.eventos} eventos`}
                  className={`cursor-pointer border-b border-border last:border-0 transition-colors ${
                    activa ? "bg-accent-600/10" : "hover:bg-surface-tertiary"
                  }`}
                >
                  <td className="px-3 py-1.5 text-content">
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: r.eventos > 0 ? "var(--accent-600)" : "transparent", border: r.eventos > 0 ? "none" : "1px solid var(--border)" }}
                      />
                      {r.nombre}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-content-secondary">{r.eventos}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-content-muted">{r.porcentaje.toFixed(1)}%</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-content-secondary">
                    {r.magnitudMaxima != null ? r.magnitudMaxima.toFixed(1) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-border px-3.5 py-2 text-[11px]">
        <span className={coincide ? "text-content-muted" : "text-danger"}>
          {coincide ? "✓ " : "⚠ "}Σ regiones = {suma.toLocaleString("es-PE")}
        </span>
        <span className="text-content-muted">Total = {total.toLocaleString("es-PE")}</span>
      </footer>
    </section>
  );
}
