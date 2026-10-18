import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ChipFiltro, FiltrosUsuarios } from "../types";
import {
  ORDEN_POR_DEFECTO,
  TAMANO_POR_DEFECTO,
  chipsUsuarios,
  filtrosUsuariosDesdeParams,
  paginaDesdeParams,
  tamanoDesdeParams,
} from "../schemas/usuarios.schema";

interface EstadoURL {
  filtros: FiltrosUsuarios;
  pagina: number;
  tamano: number;
}

/**
 * El estado del módulo (filtros, página y tamaño) vive en la URL: es la única
 * fuente de la verdad, de modo que cada vista es compartible.
 */
export function useUsuariosURL() {
  const [params, setParams] = useSearchParams();

  const filtros = useMemo(() => filtrosUsuariosDesdeParams(params), [params]);
  const pagina = useMemo(() => paginaDesdeParams(params), [params]);
  const tamano = useMemo(() => tamanoDesdeParams(params), [params]);

  const escribir = useCallback(
    (siguiente: EstadoURL) => {
      const p = new URLSearchParams();
      const f = siguiente.filtros;
      if (f.estado) p.set("estado", f.estado);
      if (f.rol) p.set("rol", f.rol);
      if (f.q) p.set("q", f.q);
      if (f.ultimoAcceso) p.set("acceso", f.ultimoAcceso);
      if (f.orden !== ORDEN_POR_DEFECTO) p.set("orden", f.orden);
      if (siguiente.pagina > 1) p.set("pag", String(siguiente.pagina));
      if (siguiente.tamano !== TAMANO_POR_DEFECTO) p.set("tam", String(siguiente.tamano));
      setParams(p, { replace: true });
    },
    [setParams],
  );

  const setFiltros = useCallback(
    (patch: Partial<FiltrosUsuarios>) =>
      escribir({ filtros: { ...filtros, ...patch }, pagina: 1, tamano }),
    [escribir, filtros, tamano],
  );

  const quitarChip = useCallback(
    (clave: string) => {
      if (clave === "estado") setFiltros({ estado: "" });
      else if (clave === "rol") setFiltros({ rol: "" });
      else if (clave === "q") setFiltros({ q: "" });
      else if (clave === "acceso") setFiltros({ ultimoAcceso: "" });
      else if (clave === "orden") setFiltros({ orden: ORDEN_POR_DEFECTO });
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
    () =>
      escribir({
        filtros: { estado: "", rol: "", q: "", ultimoAcceso: "", orden: ORDEN_POR_DEFECTO },
        pagina: 1,
        tamano,
      }),
    [escribir, tamano],
  );

  const chips: ChipFiltro[] = chipsUsuarios(filtros);

  return { filtros, pagina, tamano, chips, setFiltros, quitarChip, irAPagina, setTamano, limpiar };
}
