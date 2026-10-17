import type { ReactNode } from "react";
import Card from "@/components/ui/Card";
import { IconFilter } from "@/components/ui/Icons";

interface ModuleStubProps {
  title: string;
  /** nota especial del módulo (p. ej. "Capa base pendiente") */
  note?: string;
  actions?: ReactNode;
}

/** Página de módulo "en blanco": encabezado + filtros vacíos + estado de construcción. */
export default function ModuleStub({ title, note, actions }: ModuleStubProps) {
  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-xl font-bold text-content">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {note && <p className="text-xs text-content-muted mb-4">{note}</p>}

      {/* Filtros vacíos (placeholders hasta la implementación del módulo) */}
      <div className="auth-surface bg-surface border border-border rounded-lg px-4 py-3 mb-4 flex items-center gap-2 opacity-60" aria-hidden="true">
        <IconFilter size={14} className="text-content-muted" />
        <span className="text-xs text-content-muted">Filtros del módulo (pendientes de implementar)</span>
      </div>

      <Card>
        <div className="text-center py-10">
          <p className="text-sm font-semibold text-content">Módulo en construcción</p>
          <p className="text-xs text-content-muted mt-1">
            Esta vista se implementará en una fase posterior. Los KPIs y gráficos relacionados están en el Dashboard.
          </p>
        </div>
      </Card>
    </div>
  );
}
