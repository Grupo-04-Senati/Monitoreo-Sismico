import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { IconClose, IconExpand, IconCollapse } from "@/components/ui/Icons";

interface ExpandModalProps {
  title: string;
  onClose: () => void;
  /** Contenido fijo o función que recibe el modo pantalla completa */
  children: ReactNode | ((ctx: { full: boolean }) => ReactNode);
  footer?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal de ampliación accesible:
 * - role="dialog" + aria-modal
 * - Esc cierra
 * - el foco queda dentro del modal (trampa de foco) y vuelve al disparador al cerrar
 * - bloquea el scroll del fondo
 */
export default function ExpandModal({ title, onClose, children, footer }: ExpandModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [full, setFull] = useState(false);

  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        closeRef.current();
        return;
      }
      if (ev.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (nodes.length === 0) {
        ev.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex ${
        full ? "" : "items-center justify-center p-3 sm:p-6"
      }`}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`auth-surface relative w-full flex flex-col focus:outline-none ${
          full
            ? "h-full max-w-none border border-border"
            : "border border-border rounded-xl shadow-2xl max-w-6xl max-h-[94vh]"
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border shrink-0">
          <h2 className="font-semibold text-sm text-content">{title}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFull((f) => !f)}
              className="p-1.5 rounded-md text-content-muted hover:text-content hover:bg-surface-tertiary transition-colors"
              aria-label={full ? "Salir de pantalla completa" : "Ver en pantalla completa"}
              title={full ? "Salir de pantalla completa" : "Ver en pantalla completa"}
              aria-pressed={full}
            >
              {full ? <IconCollapse size={16} /> : <IconExpand size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-content-muted hover:text-content hover:bg-surface-tertiary transition-colors"
              aria-label="Cerrar vista ampliada"
            >
              <IconClose size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col">
          {typeof children === "function" ? children({ full }) : children}
        </div>

        {footer && (
          <div
            className={`px-5 py-3 border-t border-border bg-surface-secondary text-xs font-medium text-content-secondary shrink-0 ${
              full ? "" : "rounded-b-xl"
            }`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
