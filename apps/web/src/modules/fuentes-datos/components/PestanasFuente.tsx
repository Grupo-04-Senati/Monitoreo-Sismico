import type { TabFuente } from "../types";
import { TABS } from "../schemas/fuentes.schema";
import { IconExpand } from "@/components/ui/Icons";

interface PestanasFuenteProps {
  tab: TabFuente;
  onCambiar: (tab: TabFuente) => void;
  conteos?: Partial<Record<TabFuente, number>>;
  /** Al pulsar la pestaña ya activa se abre su vista ampliada. */
  onExpandirActiva?: (tab: TabFuente) => void;
}

/** Navegación por pestañas del módulo (patrón tablist accesible). */
export default function PestanasFuente({ tab, onCambiar, conteos, onExpandirActiva }: PestanasFuenteProps) {
  return (
    <div role="tablist" aria-label="Secciones de la fuente" className="mb-3 flex flex-wrap gap-1 border-b border-border">
      {TABS.map((t) => {
        const activa = t.value === tab;
        const conteo = conteos?.[t.value];
        const ampliar = activa && onExpandirActiva;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            id={`tab-${t.value}`}
            aria-selected={activa}
            aria-controls={`panel-${t.value}`}
            title={ampliar ? "Volver a pulsar para ver en pantalla completa" : undefined}
            onClick={() => (ampliar ? onExpandirActiva(t.value) : onCambiar(t.value))}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${
              activa
                ? "border-accent-500 text-content"
                : "border-transparent text-content-secondary hover:text-content"
            }`}
          >
            {t.label}
            {conteo != null && (
              <span className="rounded-full bg-surface-tertiary px-1.5 py-0.5 text-[10px] font-semibold text-content-muted">
                {conteo.toLocaleString("es-PE")}
              </span>
            )}
            {ampliar && <IconExpand size={12} className="text-content-muted" />}
          </button>
        );
      })}
    </div>
  );
}

