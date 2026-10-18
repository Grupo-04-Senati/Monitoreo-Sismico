import type { ChipFiltro, EstadoConector, EstadoEjecucion, FiltrosEjecuciones, FiltrosLogs, NivelLog, OpcionFiltro, OrdenLista, TabFuente } from "../types";

/* ════════════════════════════════════════════════════════════════
   Contrato del módulo "Fuentes de datos": valores por defecto, opciones
   de los selectores, etiquetas/colores y traducción entre el estado y los
   parámetros de la URL (fuente de la verdad, como en Eventos).
   ════════════════════════════════════════════════════════════════ */

export const TAB_POR_DEFECTO: TabFuente = "ejecuciones";
export const PERIODO_POR_DEFECTO = "12h";
export const TAMANO_POR_DEFECTO = 10;
export const TAMANOS_PAGINA = [5, 10, 25] as const;
export const ORDEN_POR_DEFECTO: OrdenLista = "recientes";

export const TABS: { value: TabFuente; label: string }[] = [
  { value: "ejecuciones", label: "Ejecuciones" },
  { value: "calidad", label: "Calidad" },
  { value: "registro", label: "Registro (logs)" },
  { value: "configuracion", label: "Configuración" },
];

export const ORDENES: OpcionFiltro[] = [
  { value: "recientes", label: "Últimos primero" },
  { value: "antiguos", label: "Primeros primero" },
];

export const PERIODOS: OpcionFiltro[] = [
  { value: "1h", label: "Última hora" },
  { value: "3h", label: "Últimas 3 h" },
  { value: "12h", label: "Últimas 12 h" },
];

export const ESTADOS_EJECUCION: OpcionFiltro[] = [
  { value: "", label: "Todos los estados" },
  { value: "correcta", label: "Correcta" },
  { value: "con_errores", label: "Con errores" },
  { value: "fallida", label: "Fallida" },
  { value: "en_curso", label: "En curso" },
];

export const NIVELES_LOG: OpcionFiltro[] = [
  { value: "", label: "Todos los niveles" },
  { value: "INFO", label: "INFO" },
  { value: "WARN", label: "WARN" },
  { value: "ERROR", label: "ERROR" },
];

/* ════ Etiquetas y colores ════ */

/** El color de estado solo se usa para la salud operativa, no para eventos. */
export const ETIQUETA_CONECTOR: Record<EstadoConector, string> = {
  operativo: "Operativo",
  degradado: "Degradado",
  sin_conexion: "Sin conexión",
};

export const COLOR_CONECTOR: Record<EstadoConector, string> = {
  operativo: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  degradado: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  sin_conexion: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export const ETIQUETA_EJECUCION: Record<EstadoEjecucion, string> = {
  correcta: "Correcta",
  con_errores: "Con errores",
  fallida: "Fallida",
  en_curso: "En curso",
};

export const COLOR_EJECUCION: Record<EstadoEjecucion, string> = {
  correcta: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  con_errores: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  fallida: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  en_curso: "bg-accent-500/15 text-accent-600 dark:text-accent-400",
};

export const ETIQUETA_NIVEL: Record<NivelLog, string> = {
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
};

export const COLOR_NIVEL: Record<NivelLog, string> = {
  INFO: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  WARN: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  ERROR: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

/* ════ URL ⇄ estado ════ */

function esTab(v: string | null): v is TabFuente {
  return v === "ejecuciones" || v === "calidad" || v === "registro" || v === "configuracion";
}

function esEstadoEjecucion(v: string | null): v is EstadoEjecucion {
  return v === "correcta" || v === "con_errores" || v === "fallida" || v === "en_curso";
}

function esNivel(v: string | null): v is NivelLog {
  return v === "INFO" || v === "WARN" || v === "ERROR";
}

function esOrden(v: string | null): v is OrdenLista {
  return v === "recientes" || v === "antiguos";
}

export function tabDesdeParams(params: URLSearchParams): TabFuente {
  const t = params.get("tab");
  return esTab(t) ? t : TAB_POR_DEFECTO;
}

export function filtrosEjecDesdeParams(params: URLSearchParams): FiltrosEjecuciones {
  const estado = params.get("estado");
  const periodo = params.get("periodo") ?? "";
  const orden = params.get("orden");
  return {
    estado: esEstadoEjecucion(estado) ? estado : "",
    periodo: PERIODOS.some((p) => p.value === periodo) ? periodo : PERIODO_POR_DEFECTO,
    orden: esOrden(orden) ? orden : ORDEN_POR_DEFECTO,
  };
}

export function filtrosLogsDesdeParams(params: URLSearchParams): FiltrosLogs {
  const nivel = params.get("nivel");
  const orden = params.get("orden");
  return { nivel: esNivel(nivel) ? nivel : "", orden: esOrden(orden) ? orden : ORDEN_POR_DEFECTO };
}

export function paginaDesdeParams(params: URLSearchParams): number {
  const n = Number(params.get("pag"));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function tamanoDesdeParams(params: URLSearchParams): number {
  const n = Number(params.get("tam"));
  return (TAMANOS_PAGINA as readonly number[]).includes(n) ? n : TAMANO_POR_DEFECTO;
}

/* ════ Etiquetas para chips y pie ════ */

export function hayFiltrosEjec(f: FiltrosEjecuciones): boolean {
  return f.periodo !== PERIODO_POR_DEFECTO || Boolean(f.estado) || f.orden !== ORDEN_POR_DEFECTO;
}

export function hayFiltrosLogs(f: FiltrosLogs): boolean {
  return Boolean(f.nivel) || f.orden !== ORDEN_POR_DEFECTO;
}

const etiquetaOrden = (o: OrdenLista) => ORDENES.find((x) => x.value === o)?.label ?? o;

export function chipsEjec(f: FiltrosEjecuciones): ChipFiltro[] {
  const chips: ChipFiltro[] = [];
  if (f.periodo !== PERIODO_POR_DEFECTO) {
    chips.push({ clave: "periodo", etiqueta: `Periodo: ${PERIODOS.find((p) => p.value === f.periodo)?.label ?? f.periodo}` });
  }
  if (f.estado) chips.push({ clave: "estado", etiqueta: `Estado: ${ETIQUETA_EJECUCION[f.estado]}` });
  if (f.orden !== ORDEN_POR_DEFECTO) chips.push({ clave: "orden", etiqueta: `Orden: ${etiquetaOrden(f.orden)}` });
  return chips;
}

export function chipsLogs(f: FiltrosLogs): ChipFiltro[] {
  const chips: ChipFiltro[] = [];
  if (f.nivel) chips.push({ clave: "nivel", etiqueta: `Nivel: ${f.nivel}` });
  if (f.orden !== ORDEN_POR_DEFECTO) chips.push({ clave: "orden", etiqueta: `Orden: ${etiquetaOrden(f.orden)}` });
  return chips;
}
