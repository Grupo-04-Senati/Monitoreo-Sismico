import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { FiltrosMapa } from "../types";
import {
  FILTROS_POR_DEFECTO,
  filtroSinChip,
  filtrosAParams,
  filtrosDesdeParams,
  hayFiltrosActivos,
  validarFiltros,
} from "../schemas/filtros.schema";

/**
 * Filtros del mapa en la URL: única fuente de la verdad. Así el estado es
 * compartible y los enlaces traen los filtros aplicados.
 */
export function useFiltrosMapaURL() {
  const [params, setParams] = useSearchParams();

  const filtros = useMemo(() => filtrosDesdeParams(params), [params]);
  const errores = useMemo(() => validarFiltros(filtros), [filtros]);
  const hayFiltros = useMemo(() => hayFiltrosActivos(filtros), [filtros]);

  const escribir = useCallback(
    (siguiente: FiltrosMapa) => {
      setParams(filtrosAParams(siguiente), { replace: true });
    },
    [setParams],
  );

  const setFiltros = useCallback(
    (patch: Partial<FiltrosMapa>) => {
      escribir({ ...filtros, ...patch });
    },
    [escribir, filtros],
  );

  const quitarChip = useCallback((clave: string) => setFiltros(filtroSinChip(clave)), [setFiltros]);

  const limpiar = useCallback(() => escribir(FILTROS_POR_DEFECTO), [escribir]);

  return { filtros, errores, hayFiltros, setFiltros, quitarChip, limpiar };
}
