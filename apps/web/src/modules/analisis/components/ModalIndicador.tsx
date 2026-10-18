import { useEffect } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "@/components/ui/Icons";
import type { KpiInfo } from "../types";

interface ModalIndicadorProps {
  kpi: KpiInfo;
  meta: string;
  onCerrar: () => void;
}

/** Detalle de un indicador: valor, significado y cómo se calcula. */
export default function ModalIndicador({ kpi, meta, onCerrar }: ModalIndicadorProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  return createPortal(
    <div className="fixed inset-0 z-[110] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/45" onClick={onCerrar} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={kpi.etiqueta}
        style={{ background: "var(--surface)" }}
        className="auth-surface relative w-full max-w-lg rounded-xl border border-border shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-content-muted">{kpi.etiqueta}</p>
            <p className="text-2xl font-bold text-content">{kpi.valor}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-md p-1.5 text-content-muted transition-colors hover:bg-surface-tertiary hover:text-content"
            aria-label="Cerrar"
          >
            <IconClose size={16} />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4 text-xs text-content-secondary">
          <p className="text-content-muted">{kpi.pista}</p>
          <p>
            <b className="text-content">Qué significa.</b> {kpi.significado}
          </p>
          <p>
            <b className="text-content">Cómo se calcula.</b> {kpi.calculo}
          </p>
          <p className="text-[11px] text-content-muted">{meta}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
