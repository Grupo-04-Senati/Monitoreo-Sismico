import { useEffect } from "react";

const MAX_ROTATE_X = 4.5;
const MAX_ROTATE_Y = 6;
const PERSPECTIVE = 1100;

/**
 * Inclinación 3D siguiendo el cursor, como la tarjeta del login.
 *
 * Rendimiento: un solo listener delegado, el rectángulo de cada tarjeta se mide
 * una vez (se invalida al redimensionar/hacer scroll) y se escribe como máximo
 * un transform por frame (requestAnimationFrame).
 */
export function useTiltCards() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let current: HTMLElement | null = null;
    let rects = new WeakMap<HTMLElement, DOMRect>();
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const clear = () => {
      if (current) current.style.transform = "";
      current = null;
    };

    const apply = () => {
      frame = 0;
      if (!current) return;
      const rect = rects.get(current) ?? current.getBoundingClientRect();
      rects.set(current, rect);
      if (!rect.width || !rect.height) return;

      const x = (pointerX - rect.left) / rect.width - 0.5;
      const y = (pointerY - rect.top) / rect.height - 0.5;
      const rotateX = (-y * MAX_ROTATE_X).toFixed(2);
      const rotateY = (x * MAX_ROTATE_Y).toFixed(2);
      current.style.transform = `perspective(${PERSPECTIVE}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px) scale(1.006)`;
    };

    const onMove = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const card = (target?.closest?.(".tilt") as HTMLElement | null) ?? null;

      if (card !== current) {
        if (current) current.style.transform = "";
        current = card;
      }
      if (!card) return;

      pointerX = e.clientX;
      pointerY = e.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };

    const invalidate = () => {
      rects = new WeakMap<HTMLElement, DOMRect>();
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", invalidate, { passive: true, capture: true });
    window.addEventListener("resize", invalidate, { passive: true });
    window.addEventListener("blur", clear);
    return () => {
      document.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", invalidate, true);
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("blur", clear);
      if (frame) cancelAnimationFrame(frame);
      clear();
    };
  }, []);
}
