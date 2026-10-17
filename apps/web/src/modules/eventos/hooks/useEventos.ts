import { useCallback, useEffect, useState } from "react";
import type { FiltrosEventos, OrdenEventos, PaginaEventos, ResumenEventos } from "../types";
import { listarEventos, resumirEventos } from "../services/eventos.service";

interface EstadoEventos {
  cargando: boolean;
  error: string | null;
  datos: PaginaEventos | null;
  resumen: ResumenEventos | null;
}

/**
 * Carga la página de eventos y los totales de la selección que corresponden a
 * los filtros/orden actuales. Mantiene los datos previos mientras recarga
 * (para no parpadear) y expone `reintentar` para el estado de error.
 */
export function useEventos(filtros: FiltrosEventos, orden: OrdenEventos, pagina: number, tamano: number) {
  const [estado, setEstado] = useState<EstadoEventos>({
    cargando: true,
    error: null,
    datos: null,
    resumen: null,
  });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setEstado((s) => ({ cargando: true, error: null, datos: s.datos, resumen: s.resumen }));

    Promise.all([listarEventos(filtros, orden, { numero: pagina, tamano }), resumirEventos(filtros)])
      .then(([datos, resumen]) => {
        if (vigente) setEstado({ cargando: false, error: null, datos, resumen });
      })
      .catch((e: unknown) => {
        if (vigente) {
          setEstado({
            cargando: false,
            error: e instanceof Error ? e.message : "No se pudieron cargar los eventos.",
            datos: null,
            resumen: null,
          });
        }
      });

    return () => {
      vigente = false;
    };
  }, [filtros, orden, pagina, tamano, intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  return { ...estado, reintentar };
}
