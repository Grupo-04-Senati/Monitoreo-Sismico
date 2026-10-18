import { useEffect, useState } from "react";
import type { EjecucionFuente, FiltrosEjecuciones } from "../types";
import { listarEjecucionesVentana } from "../services/fuentes.service";

/** Todas las ejecuciones de la ventana filtrada (sin paginar), para el gráfico. */
export function useEjecucionesVentana(filtros: FiltrosEjecuciones) {
  const [filas, setFilas] = useState<EjecucionFuente[]>([]);

  useEffect(() => {
    let vigente = true;
    listarEjecucionesVentana(filtros).then((f) => {
      if (vigente) setFilas(f);
    });
    return () => {
      vigente = false;
    };
  }, [filtros]);

  return filas;
}
