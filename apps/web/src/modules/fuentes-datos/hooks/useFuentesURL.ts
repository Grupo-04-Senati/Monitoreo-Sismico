import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ChipFiltro, FiltrosEjecuciones, FiltrosLogs, TabFuente } from "../types";
import {
  ORDEN_POR_DEFECTO,
  PERIODO_POR_DEFECTO,
  TAB_POR_DEFECTO,
  TAMANO_POR_DEFECTO,
  chipsEjec,
  chipsLogs,
  filtrosEjecDesdeParams,
  filtrosLogsDesdeParams,
  paginaDesdeParams,
  tabDesdeParams,
  tamanoDesdeParams,
} from "../schemas/fuentes.schema";

interface EstadoURL {
  tab: TabFuente;
  ejec: FiltrosEjecuciones;
  logs: FiltrosLogs;
  pagina: number;
  tamano: number;
}

/**
 * El estado del módulo (pestaña, filtros, página y tamaño) vive en la URL: es
 * la única fuente de la verdad, de modo que cada vista es compartible.
 */
export function useFuentesURL() {
  const [params, setParams] = useSearchParams();

  const tab = useMemo(() => tabDesdeParams(params), [params]);
  const ejec = useMemo(() => filtrosEjecDesdeParams(params), [params]);
  const logs = useMemo(() => filtrosLogsDesdeParams(params), [params]);
  const pagina = useMemo(() => paginaDesdeParams(params), [params]);
  const tamano = useMemo(() => tamanoDesdeParams(params), [params]);

  const escribir = useCallback(
    (siguiente: EstadoURL) => {
      const p = new URLSearchParams();
      if (siguiente.tab !== TAB_POR_DEFECTO) p.set("tab", siguiente.tab);
      if (siguiente.ejec.estado) p.set("estado", siguiente.ejec.estado);
      if (siguiente.ejec.periodo !== PERIODO_POR_DEFECTO) p.set("periodo", siguiente.ejec.periodo);
      if (siguiente.logs.nivel) p.set("nivel", siguiente.logs.nivel);
      if (siguiente.ejec.orden !== ORDEN_POR_DEFECTO) p.set("orden", siguiente.ejec.orden);
      if (siguiente.pagina > 1) p.set("pag", String(siguiente.pagina));
      if (siguiente.tamano !== TAMANO_POR_DEFECTO) p.set("tam", String(siguiente.tamano));
      setParams(p, { replace: true });
    },
    [setParams],
  );

  const setTab = useCallback(
    (t: TabFuente) => escribir({ tab: t, ejec, logs, pagina: 1, tamano }),
    [escribir, ejec, logs, tamano],
  );

  const setFiltrosEjec = useCallback(
    (patch: Partial<FiltrosEjecuciones>) => escribir({ tab, ejec: { ...ejec, ...patch }, logs, pagina: 1, tamano }),
    [escribir, tab, ejec, logs, tamano],
  );

  const setFiltrosLogs = useCallback(
    (patch: Partial<FiltrosLogs>) => escribir({ tab, ejec, logs: { ...logs, ...patch }, pagina: 1, tamano }),
    [escribir, tab, ejec, logs, tamano],
  );

  const quitarChip = useCallback(
    (clave: string) => {
      if (clave === "periodo") setFiltrosEjec({ periodo: PERIODO_POR_DEFECTO });
      else if (clave === "estado") setFiltrosEjec({ estado: "" });
      else if (clave === "nivel") setFiltrosLogs({ nivel: "" });
      else if (clave === "orden") {
        setFiltrosEjec({ orden: ORDEN_POR_DEFECTO });
        setFiltrosLogs({ orden: ORDEN_POR_DEFECTO });
      }
    },
    [setFiltrosEjec, setFiltrosLogs],
  );

  const irAPagina = useCallback(
    (n: number) => escribir({ tab, ejec, logs, pagina: Math.max(1, n), tamano }),
    [escribir, tab, ejec, logs, tamano],
  );

  const setTamano = useCallback(
    (n: number) => escribir({ tab, ejec, logs, pagina: 1, tamano: n }),
    [escribir, tab, ejec, logs],
  );

  /** Limpia los filtros de la pestaña activa; conserva pestaña y tamaño. */
  const limpiar = useCallback(() => {
    if (tab === "registro") escribir({ tab, ejec, logs: { nivel: "", orden: ORDEN_POR_DEFECTO }, pagina: 1, tamano });
    else escribir({ tab, ejec: { estado: "", periodo: PERIODO_POR_DEFECTO, orden: ORDEN_POR_DEFECTO }, logs, pagina: 1, tamano });
  }, [escribir, tab, ejec, logs, tamano]);

  const chips: ChipFiltro[] = tab === "registro" ? chipsLogs(logs) : chipsEjec(ejec);

  return {
    tab,
    ejec,
    logs,
    pagina,
    tamano,
    chips,
    setTab,
    setFiltrosEjec,
    setFiltrosLogs,
    quitarChip,
    irAPagina,
    setTamano,
    limpiar,
  };
}
