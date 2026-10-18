import { useCallback, useEffect, useState } from "react";
import type { FiltrosLogs, PaginaLogs } from "../types";
import { listarLogs } from "../services/fuentes.service";

interface Estado {
  cargando: boolean;
  error: string | null;
  datos: PaginaLogs | null;
}

/** Carga la página del registro de la ingesta para el nivel y la paginación actuales. */
export function useLogs(filtros: FiltrosLogs, pagina: number, tamano: number) {
  const [estado, setEstado] = useState<Estado>({ cargando: true, error: null, datos: null });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setEstado((s) => ({ cargando: true, error: null, datos: s.datos }));
    listarLogs(filtros, pagina, tamano)
      .then((datos) => {
        if (vigente) setEstado({ cargando: false, error: null, datos });
      })
      .catch((e: unknown) => {
        if (vigente) {
          setEstado({
            cargando: false,
            error: e instanceof Error ? e.message : "No se pudo cargar el registro.",
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
