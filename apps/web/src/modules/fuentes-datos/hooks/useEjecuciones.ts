import { useCallback, useEffect, useState } from "react";
import type { FiltrosEjecuciones, PaginaEjecuciones } from "../types";
import { listarEjecuciones } from "../services/fuentes.service";

interface Estado {
  cargando: boolean;
  error: string | null;
  datos: PaginaEjecuciones | null;
}

/** Carga la página de ejecuciones para los filtros y la paginación actuales. */
export function useEjecuciones(filtros: FiltrosEjecuciones, pagina: number, tamano: number) {
  const [estado, setEstado] = useState<Estado>({ cargando: true, error: null, datos: null });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setEstado((s) => ({ cargando: true, error: null, datos: s.datos }));
    listarEjecuciones(filtros, pagina, tamano)
      .then((datos) => {
        if (vigente) setEstado({ cargando: false, error: null, datos });
      })
      .catch((e: unknown) => {
        if (vigente) {
          setEstado({
            cargando: false,
            error: e instanceof Error ? e.message : "No se pudieron cargar las ejecuciones.",
            datos: null,
          });
        }
      });
    return () => {
      vigente = false;
    };
  }, [filtros, pagina, tamano, intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);
  return { ...estado, reintentar };
}
