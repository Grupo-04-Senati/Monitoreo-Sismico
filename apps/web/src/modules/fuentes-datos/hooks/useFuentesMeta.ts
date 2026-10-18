import { useCallback, useEffect, useState } from "react";
import { cargarMeta, type MetaFuente } from "../services/fuentes.service";

interface EstadoMeta {
  cargando: boolean;
  error: string | null;
  meta: MetaFuente | null;
}

/** Carga la ficha, el resumen, la calidad y la configuración del conector. */
export function useFuentesMeta() {
  const [estado, setEstado] = useState<EstadoMeta>({ cargando: true, error: null, meta: null });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setEstado((s) => ({ cargando: true, error: null, meta: s.meta }));
    cargarMeta()
      .then((meta) => {
        if (vigente) setEstado({ cargando: false, error: null, meta });
      })
      .catch((e: unknown) => {
        if (vigente) {
          setEstado({
            cargando: false,
            error: e instanceof Error ? e.message : "No se pudo cargar la fuente.",
            meta: null,
          });
        }
      });
    return () => {
      vigente = false;
    };
  }, [intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);
  return { ...estado, reintentar };
}
