import type { ReactNode } from "react";
import { IconInfo } from "@/components/ui/Icons";

/** Aviso fijo: son avisos operativos internos de la empresa, no alertas oficiales. */
export default function AvisoAlertas({ children }: { children?: ReactNode }) {
  return (
    <div
      role="note"
      className="mb-3 flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-slate-500 bg-surface px-3.5 py-2.5 text-[11px] leading-relaxed text-content-secondary"
    >
      <IconInfo size={14} className="mt-0.5 shrink-0 text-content-muted" />
      <span>
        <b className="font-semibold text-content">Avisos internos.</b> Se generan con sismos ya ocurridos y registrados
        por la fuente (USGS) para el personal de la empresa. No predicen sismos, no son alertas oficiales y no sustituyen
        la información del IGP ni de INDECI. Las estimaciones de ML nunca generan avisos. {children}
      </span>
    </div>
  );
}
