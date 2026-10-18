import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ChipFiltro, FiltrosReportes } from "../types";
import {
  SOLICITANTE_POR_DEFECTO,
  TAMANO_POR_DEFECTO,
  chipsReportes,
  filtrosReportesDesdeParams,
  paginaDesdeParams,
  tamanoDesdeParams,
} from "../schemas/reportes.schema";

interface EstadoURL {
  filtros: FiltrosReportes;
  pagina: number;
  tamano: number;
}

/**
 * El estado del módulo (filtros, página y tamaño) vive en la URL: es la única
 * fuente de la verdad, de modo que cada vista es compartible.
 */
export function useReportesURL(nombreSolicitante: string) {
  const [params, setParams] = useSearchParams();

  const filtros = useMemo(() => filtrosReportesDesdeParams(params), [params]);
  const pagina = useMemo(() => paginaDesdeParams(params), [params]);
  const tamano = useMemo(() => tamanoDesdeParams(params), [params]);

  const escribir = useCallback(
    (siguiente: EstadoURL) => {
      const p = new URLSearchParams();
      const f = siguiente.filtros;
      if (f.tipo) p.set("tipo", f.tipo);
      if (f.estado) p.set("estado", f.estado);
      if (f.solicitante) p.set("sol", f.solicitante);
      if (siguiente.pagina > 1) p.set("pag", String(siguiente.pagina));
      if (siguiente.tamano !== TAMANO_POR_DEFECTO) p.set("tam", String(siguiente.tamano));
      setParams(p, { replace: true });
    },
    [setParams],
  );

  const setFiltros = useCallback(
    (patch: Partial<FiltrosReportes>) => escribir({ filtros: { ...filtros, ...patch }, pagina: 1, tamano }),
    [escribir, filtros, tamano],
  );

  const quitarChip = useCallback(
    (clave: string) => {
      if (clave === "tipo") setFiltros({ tipo: "" });
      else if (clave === "estado") setFiltros({ estado: "" });
      else if (clave === "sol") setFiltros({ solicitante: SOLICITANTE_POR_DEFECTO });
    },
    [setFiltros],
  );

  const irAPagina = useCallback(
    (n: number) => escribir({ filtros, pagina: Math.max(1, n), tamano }),
    [escribir, filtros, tamano],
  );

  const setTamano = useCallback(
    (n: number) => escribir({ filtros, pagina: 1, tamano: n }),
    [escribir, filtros],
  );

  const limpiar = useCallback(
    () => escribir({ filtros: { tipo: "", estado: "", solicitante: SOLICITANTE_POR_DEFECTO }, pagina: 1, tamano }),
    [escribir, tamano],
  );

  const chips: ChipFiltro[] = chipsReportes(filtros, nombreSolicitante);

  return { filtros, pagina, tamano, chips, setFiltros, quitarChip, irAPagina, setTamano, limpiar };
}
