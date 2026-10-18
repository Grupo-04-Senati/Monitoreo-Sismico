import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { CampoOrdenEventos, FiltrosEventos, OrdenEventos } from "../types";
import {
  CLAVES_COLUMNAS,
  ORDEN_POR_DEFECTO,
  PERIODO_POR_DEFECTO,
  TAMANO_POR_DEFECTO,
  columnasAValor,
  columnasDesdeParams,
  filtroSinChip,
  filtrosAParams,
  filtrosDesdeParams,
  hayFiltrosActivos,
  ordenDesdeParams,
  paginaDesdeParams,
  tamanoDesdeParams,
  validarFiltros,
} from "../schemas/filtros.schema";

const CAMPOS_TEXTO: CampoOrdenEventos[] = ["localidad", "region", "estado"];

interface EstadoURL {
  filtros: FiltrosEventos;
  orden: OrdenEventos;
  pagina: number;
  tamano: number;
  columnas: string[];
}

/**
 * Los filtros, el orden, la paginación y las columnas visibles viven en la URL:
 * es la única fuente de la verdad, así el estado es compartible y los enlaces
 * del Dashboard (`?zona=…&magmin=…`) llegan con los filtros aplicados.
 */
export function useFiltrosURL() {
  const [params, setParams] = useSearchParams();

  const filtros = useMemo(() => filtrosDesdeParams(params), [params]);
  const orden = useMemo(() => ordenDesdeParams(params), [params]);
  const pagina = useMemo(() => paginaDesdeParams(params), [params]);
  const tamano = useMemo(() => tamanoDesdeParams(params), [params]);
  const columnas = useMemo(() => columnasDesdeParams(params), [params]);
  const errores = useMemo(() => validarFiltros(filtros), [filtros]);
  const hayFiltros = useMemo(() => hayFiltrosActivos(filtros), [filtros]);

  const escribir = useCallback(
    (siguiente: EstadoURL) => {
      const p = filtrosAParams(siguiente.filtros);
      if (siguiente.orden.campo !== ORDEN_POR_DEFECTO.campo || siguiente.orden.direccion !== ORDEN_POR_DEFECTO.direccion) {
        p.set("orden", siguiente.orden.campo);
        p.set("dir", siguiente.orden.direccion);
      }
      if (siguiente.pagina > 1) p.set("pagina", String(siguiente.pagina));
      if (siguiente.tamano !== TAMANO_POR_DEFECTO) p.set("tamano", String(siguiente.tamano));
      const cols = columnasAValor(siguiente.columnas);
      if (cols) p.set("cols", cols);
      setParams(p, { replace: true });
    },
    [setParams],
  );

  /** Cambia filtros; siempre vuelve a la primera página. */
  const setFiltros = useCallback(
    (patch: Partial<FiltrosEventos>) => {
      escribir({ filtros: { ...filtros, ...patch }, orden, pagina: 1, tamano, columnas });
    },
    [escribir, filtros, orden, tamano, columnas],
  );

  /** Quita un chip de filtro concreto. */
  const quitarChip = useCallback((clave: string) => setFiltros(filtroSinChip(clave)), [setFiltros]);

  /** Ordena por una columna; al repetir la columna invierte la dirección. */
  const ordenarPor = useCallback(
    (campo: CampoOrdenEventos) => {
      const ascDefecto = CAMPOS_TEXTO.includes(campo);
      const direccion = orden.campo === campo ? (orden.direccion === "asc" ? "desc" : "asc") : ascDefecto ? "asc" : "desc";
      escribir({ filtros, orden: { campo, direccion }, pagina: 1, tamano, columnas });
    },
    [escribir, filtros, orden, tamano, columnas],
  );

  const irAPagina = useCallback(
    (n: number) => escribir({ filtros, orden, pagina: Math.max(1, n), tamano, columnas }),
    [escribir, filtros, orden, tamano, columnas],
  );

  const setTamano = useCallback(
    (n: number) => escribir({ filtros, orden, pagina: 1, tamano: n, columnas }),
    [escribir, filtros, orden, columnas],
  );

  /** Muestra u oculta una columna opcional. */
  const alternarColumna = useCallback(
    (clave: string) => {
      if (!CLAVES_COLUMNAS.includes(clave)) return;
      const conjunto = new Set(columnas);
      if (conjunto.has(clave)) conjunto.delete(clave);
      else conjunto.add(clave);
      escribir({ filtros, orden, pagina, tamano, columnas: [...conjunto] });
    },
    [escribir, filtros, orden, pagina, tamano, columnas],
  );

  /** Limpia los filtros; conserva orden, columnas y tamaño de página. */
  const limpiar = useCallback(() => {
    escribir({
      filtros: {
        periodo: PERIODO_POR_DEFECTO,
        desde: "",
        hasta: "",
        region: "",
        magnitudMin: null,
        magnitudMax: null,
        magnitudTipo: "",
        profundidadMin: null,
        profundidadMax: null,
        q: "",
        estado: "",
      },
      orden: ORDEN_POR_DEFECTO,
      pagina: 1,
      tamano,
      columnas,
    });
  }, [escribir, tamano, columnas]);

  return {
    filtros,
    orden,
    pagina,
    tamano,
    columnas,
    errores,
    hayFiltros,
    setFiltros,
    quitarChip,
    ordenarPor,
    irAPagina,
    setTamano,
    alternarColumna,
    limpiar,
  };
}
