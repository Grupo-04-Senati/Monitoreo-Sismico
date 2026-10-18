import { useEffect, useRef, useState } from "react";

/**
 * Mide el ancho disponible de un contenedor y lo mantiene actualizado con
 * ResizeObserver. Se usa para que los SVG de los gráficos llenen el ancho
 * disponible manteniendo una escala uniforme (sin deformar el texto).
 */
export function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setAncho(el.clientWidth);
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, ancho] as const;
}
