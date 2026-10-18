import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { IconClose, IconExpand, IconCollapse } from "@/components/ui/Icons";

interface ExpandModalProps {
  title: string;
  onClose: () => void;
  /** Contenido fijo o función que recibe el modo pantalla completa */
  children: ReactNode | ((ctx: { full: boolean }) => ReactNode);
  footer?: ReactNode;
  /**
   * Permite estirar la ventana arrastrando sus bordes/esquinas (alto y ancho).
   * Opt-in por módulo: las vistas que no lo activen se comportan igual que antes.
   */
  resizable?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Tamaño mínimo al estirar (px) y margen con el borde de la ventana. */
const MIN_W = 520;
const MIN_H = 320;
const MARGEN = 16;

type Dir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface Caja {
  left: number;
  top: number;
  w: number;
  h: number;
}

/**
 * Modal de ampliación accesible:
 * - role="dialog" + aria-modal
 * - Esc cierra
 * - el foco queda dentro del modal (trampa de foco) y vuelve al disparador al cerrar
 * - bloquea el scroll del fondo
 * - opcionalmente **redimensionable** (prop `resizable`): arrastra los lados o
 *   las esquinas para agrandar en alto/ancho. Doble clic restablece.
 */
export default function ExpandModal({ title, onClose, children, footer, resizable = false }: ExpandModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [full, setFull] = useState(false);
  const [box, setBox] = useState<Caja | null>(null);
  const dragRef = useRef<{ x: number; y: number; ini: Caja; dir: Dir } | null>(null);

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

  /** Estira la ventana desde un borde o esquina (dir) siguiendo el cursor. */
  const estirar = (dir: Dir, e: ReactPointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel || full) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = panel.getBoundingClientRect();
    const ini: Caja = box ?? { left: rect.left, top: rect.top, w: rect.width, h: rect.height };
    dragRef.current = { x: e.clientX, y: e.clientY, ini, dir };
    setBox(ini);

    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.x;
      const dy = ev.clientY - d.y;
      let { left, top, w, h } = d.ini;

      if (d.dir.includes("e")) w = Math.min(d.ini.w + dx, window.innerWidth - left - MARGEN);
      if (d.dir.includes("w")) {
        w = Math.min(d.ini.w - dx, d.ini.left + d.ini.w - MARGEN);
        left = d.ini.left + d.ini.w - w;
      }
      if (d.dir.includes("s")) h = Math.min(d.ini.h + dy, window.innerHeight - top - MARGEN);
      if (d.dir.includes("n")) {
        h = Math.min(d.ini.h - dy, d.ini.top + d.ini.h - MARGEN);
        top = d.ini.top + d.ini.h - h;
      }

      setBox({ left, top, w: Math.max(w, MIN_W), h: Math.max(h, MIN_H) });
    };
    const up = () => {
      dragRef.current = null;
      document.body.style.userSelect = prevSelect;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const estirando = resizable && !full;
  const estilo = estirando && box
    ? { position: "fixed" as const, left: box.left, top: box.top, width: box.w, height: box.h }
    : undefined;

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
        style={estilo}
        className={`auth-surface relative w-full flex flex-col focus:outline-none ${
          full
            ? "h-full max-w-none border border-border"
            : `border border-border rounded-xl shadow-2xl ${box ? "" : "max-w-6xl max-h-[94vh]"}`
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border shrink-0">
          <h2 className="font-semibold text-sm text-content">{title}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setBox(null);
                setFull((f) => !f);
              }}
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

        {estirando && <Tiradores onEstirar={estirar} onReset={() => setBox(null)} />}
      </div>
    </div>,
    document.body,
  );
}

/* ── Tiradores de borde/esquina (solo si `resizable`) ─────────── */

const borde = "absolute z-30 touch-none transition-colors hover:bg-accent-500/30";

function Tiradores({ onEstirar, onReset }: { onEstirar: (dir: Dir, e: ReactPointerEvent<HTMLDivElement>) => void; onReset: () => void }) {
  const t = (dir: Dir, clase: string) => (
    <div
      role="separator"
      aria-label="Redimensionar ventana"
      tabIndex={0}
      className={`${borde} ${clase}`}
      onPointerDown={(e) => onEstirar(dir, e)}
      onDoubleClick={onReset}
      title="Arrastra para redimensionar (doble clic restablece)"
    />
  );
  return (
    <>
      {t("n", "top-0 left-3 right-3 h-1.5 cursor-ns-resize")}
      {t("s", "bottom-0 left-3 right-3 h-1.5 cursor-ns-resize")}
      {t("w", "left-0 top-3 bottom-3 w-1.5 cursor-ew-resize")}
      {t("e", "right-0 top-3 bottom-3 w-1.5 cursor-ew-resize")}
      {t("nw", "top-0 left-0 h-3 w-3 cursor-nwse-resize")}
      {t("ne", "top-0 right-0 h-3 w-3 cursor-nesw-resize")}
      {t("sw", "bottom-0 left-0 h-3 w-3 cursor-nesw-resize")}
      {t("se", "bottom-0 right-0 h-3 w-3 cursor-nwse-resize")}
      <div
        className="pointer-events-none absolute bottom-0.5 right-0.5 z-30 text-content-muted"
        aria-hidden="true"
      >
        <svg width="12" height="12" viewBox="0 0 14 14">
          <path d="M13 5 5 13M13 9 9 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    </>
  );
}
