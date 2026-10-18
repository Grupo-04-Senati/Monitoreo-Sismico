import type { SeismicEvent } from "@/types";
import { REGION_OPTIONS } from "@/lib/catalogo";
import type {
  Agrupacion,
  ClaveFiltro,
  DefinicionGrafico,
  FiltrosAnalisis,
  MetodoCorrelacion,
  Resolucion,
  TopRegiones,
  TipoFiltro,
  VariableId,
} from "../types";

/* ════════════════════════════════════════════════════════════════
   Contrato de filtros y catálogo de gráficos del módulo de
   Análisis estadístico: valores por defecto, opciones, etiquetas de
   los chips y definición de cada tarjeta.
   ════════════════════════════════════════════════════════════════ */

/** Variables numéricas analizables (nombre, abreviatura y extractor). */
export const VARIABLES: Record<
  VariableId,
  { label: string; abrev: string; get: (e: SeismicEvent) => number }
> = {
  magnitud: { label: "Magnitud", abrev: "Mag.", get: (e) => e.magnitude },
  profundidad: { label: "Profundidad (km)", abrev: "Prof.", get: (e) => e.depthKm ?? Number.NaN },
};

export const FILTROS_POR_DEFECTO: FiltrosAnalisis = {
  periodo: "30d",
  desde: "",
  hasta: "",
  zona: "",
  magnitudMin: null,
  magnitudMax: null,
  tipo: "",
  profundidadMin: null,
  profundidadMax: null,
  agrupacion: "dia",
  resolucion: 1,
  x: "profundidad",
  y: "magnitud",
  metodo: "spearman",
  top: 8,
};

export const PERIODOS: { value: FiltrosAnalisis["periodo"]; label: string }[] = [
  { value: "24h", label: "24 h" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "rango", label: "Rango" },
];

export const AGRUPACIONES: { value: Agrupacion; label: string }[] = [
  { value: "hora", label: "Hora (solo 24 h)" },
  { value: "dia", label: "Día" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
];

export const RESOLUCIONES: { value: Resolucion; label: string }[] = [
  { value: 1, label: "1.0" },
  { value: 0.5, label: "0.5" },
];

export const VARIABLES_OPCIONES: { value: VariableId; label: string }[] = (
  Object.keys(VARIABLES) as VariableId[]
).map((k) => ({ value: k, label: VARIABLES[k].label }));

export const METODOS: { value: MetodoCorrelacion; label: string }[] = [
  { value: "spearman", label: "Spearman (rangos)" },
  { value: "pearson", label: "Pearson" },
];

export const TOPS: { value: TopRegiones; label: string }[] = [
  { value: 8, label: "Top 8" },
  { value: 15, label: "Top 15" },
  { value: 25, label: "Todas" },
];

export const TIPOS_MAGNITUD: { value: TipoFiltro; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "Mw", label: "Mw" },
  { value: "ML", label: "ML" },
  { value: "mb", label: "mb" },
  { value: "none", label: "Sin tipo" },
];

export const REGIONES: { value: string; label: string }[] = REGION_OPTIONS.map((r) => ({
  value: r.slug,
  label: r.name,
}));

/* Claves de filtro según su alcance:
   - DATOS: filtran la selección completa (panel global superior).
   - ANÁLISIS: son propios de un gráfico concreto (van dentro de su tarjeta). */
export const CLAVES_DATOS: ClaveFiltro[] = ["periodo", "zona", "magnitud", "tipo", "profundidad"];
export const CLAVES_ANALISIS: ClaveFiltro[] = ["agrupacion", "resolucion", "x", "y", "metodo", "top"];

/* ════ Catálogo de tarjetas ════ */

export const DEFINICIONES: DefinicionGrafico[] = [
  {
    id: "ts",
    titulo: "Serie temporal de eventos",
    subtitulo: "Eventos por periodo de agrupación",
    info: "Cambios en el volumen de eventos reportados. La media móvil suaviza la serie. Un cambio en el conteo puede deberse a la red de detección y no solo a la actividad.",
    filtros: ["periodo", "zona", "magnitud", "tipo", "profundidad", "agrupacion"],
    tipo: "barras",
  },
  {
    id: "mh",
    titulo: "Histograma de magnitud",
    subtitulo: "Eventos por rango de magnitud",
    info: "Cuántos eventos caen en cada rango. Hay muchos más eventos pequeños que grandes; el eje parte de 0.",
    filtros: ["periodo", "zona", "magnitud", "tipo", "profundidad", "resolucion"],
    tipo: "barras",
  },
  {
    id: "sc",
    titulo: "Dispersión X vs Y",
    subtitulo: "Por defecto: profundidad vs magnitud",
    info: "Cada punto es un evento. Muestra la distribución conjunta de dos variables; la correlación es descriptiva y no implica causalidad.",
    filtros: ["periodo", "zona", "magnitud", "tipo", "profundidad", "x", "y", "metodo"],
    tipo: "dispersion",
  },
  {
    id: "rg",
    titulo: "Conteo por región",
    subtitulo: "Eventos por región de la localidad reportada",
    info: "Eventos agrupados por la región de la localidad que informa la fuente.",
    filtros: ["periodo", "zona", "magnitud", "tipo", "profundidad", "top"],
    tipo: "barrasH",
  },
  {
    id: "dh",
    titulo: "Distribución de profundidad",
    subtitulo: "Eventos por rango de profundidad (km)",
    info: "Distribución de la profundidad del foco. Los eventos sin profundidad se cuentan como faltantes.",
    filtros: ["periodo", "zona", "magnitud", "tipo", "profundidad"],
    tipo: "barras",
  },
  {
    id: "st",
    titulo: "Resumen estadístico",
    subtitulo: "n, faltantes, tendencia central y dispersión por variable",
    info: "Estadísticos por variable sobre la selección. Los faltantes no se imputan: se excluyen del cálculo.",
    filtros: ["periodo", "zona", "magnitud", "tipo", "profundidad"],
    ancho: true,
    tipo: "tabla",
  },
  {
    id: "ev",
    titulo: "Tabla de eventos del análisis",
    subtitulo: "Eventos que componen la selección (exportable)",
    info: "Eventos individuales de la selección, ordenados del más reciente al más antiguo.",
    filtros: ["periodo", "zona", "magnitud", "tipo", "profundidad"],
    ancho: true,
    tipo: "tabla",
  },
];

/* ════ Etiquetas ════ */

export function nombreZona(slug: string): string {
  return REGIONES.find((r) => r.value === slug)?.label ?? slug;
}

export function etiquetaAgrupacion(a: Agrupacion): string {
  return AGRUPACIONES.find((x) => x.value === a)?.label ?? a;
}

const rangoTxt = (min: number | null, max: number | null): string =>
  `${min ?? 0}–${max ?? "∞"}`;

/** Texto compacto de los filtros activos (para el pie y las leyendas). */
export function resumenFiltros(f: FiltrosAnalisis): string {
  const partes: string[] = [];
  if (f.zona) partes.push(nombreZona(f.zona));
  if (f.magnitudMin != null || f.magnitudMax != null) partes.push(`mag ${rangoTxt(f.magnitudMin, f.magnitudMax)}`);
  if (f.tipo) partes.push(`tipo ${f.tipo === "none" ? "sin tipo" : f.tipo}`);
  if (f.profundidadMin != null || f.profundidadMax != null) {
    partes.push(`prof ${rangoTxt(f.profundidadMin, f.profundidadMax)} km`);
  }
  return partes.length ? partes.join(", ") : "Sin filtros de datos";
}

export interface ChipAnalisis {
  clave: ClaveFiltro;
  etiqueta: string;
}

export function hayFiltrosAnalisis(f: FiltrosAnalisis): boolean {
  return (
    f.periodo !== FILTROS_POR_DEFECTO.periodo ||
    Boolean(f.zona) ||
    f.magnitudMin != null ||
    f.magnitudMax != null ||
    Boolean(f.tipo) ||
    f.profundidadMin != null ||
    f.profundidadMax != null
  );
}

export function chipsDesdeFiltros(f: FiltrosAnalisis, etiquetaPeriodo: string): ChipAnalisis[] {
  const chips: ChipAnalisis[] = [];
  if (f.periodo !== FILTROS_POR_DEFECTO.periodo || f.desde || f.hasta) {
    chips.push({ clave: "periodo", etiqueta: etiquetaPeriodo });
  }
  if (f.zona) chips.push({ clave: "zona", etiqueta: f.zona ? nombreZona(f.zona) : "" });
  if (f.magnitudMin != null || f.magnitudMax != null) {
    chips.push({ clave: "magnitud", etiqueta: `Mag. ${rangoTxt(f.magnitudMin, f.magnitudMax)}` });
  }
  if (f.tipo) {
    chips.push({ clave: "tipo", etiqueta: `Tipo ${f.tipo === "none" ? "sin tipo" : f.tipo}` });
  }
  if (f.profundidadMin != null || f.profundidadMax != null) {
    chips.push({ clave: "profundidad", etiqueta: `Prof. ${rangoTxt(f.profundidadMin, f.profundidadMax)} km` });
  }
  if (f.agrupacion !== FILTROS_POR_DEFECTO.agrupacion) {
    chips.push({ clave: "agrupacion", etiqueta: `Agrupar: ${etiquetaAgrupacion(f.agrupacion)}` });
  }
  if (f.resolucion !== FILTROS_POR_DEFECTO.resolucion) {
    chips.push({ clave: "resolucion", etiqueta: `Resolución: ${f.resolucion.toFixed(1)}` });
  }
  if (f.x !== FILTROS_POR_DEFECTO.x) chips.push({ clave: "x", etiqueta: `X: ${VARIABLES[f.x].label}` });
  if (f.y !== FILTROS_POR_DEFECTO.y) chips.push({ clave: "y", etiqueta: `Y: ${VARIABLES[f.y].label}` });
  if (f.metodo !== FILTROS_POR_DEFECTO.metodo) {
    chips.push({ clave: "metodo", etiqueta: `Método: ${f.metodo === "spearman" ? "Spearman" : "Pearson"}` });
  }
  if (f.top !== FILTROS_POR_DEFECTO.top) chips.push({ clave: "top", etiqueta: `Regiones: ${f.top === 25 ? "Todas" : `Top ${f.top}`}` });
  return chips;
}

/** Filtros que se restauran al quitar un chip. */
export function filtroSinChip(clave: ClaveFiltro): Partial<FiltrosAnalisis> {
  switch (clave) {
    case "periodo":
      return { periodo: FILTROS_POR_DEFECTO.periodo, desde: "", hasta: "" };
    case "zona":
      return { zona: "" };
    case "magnitud":
      return { magnitudMin: null, magnitudMax: null };
    case "tipo":
      return { tipo: "" };
    case "profundidad":
      return { profundidadMin: null, profundidadMax: null };
    case "agrupacion":
      return { agrupacion: FILTROS_POR_DEFECTO.agrupacion };
    case "resolucion":
      return { resolucion: FILTROS_POR_DEFECTO.resolucion };
    case "x":
      return { x: FILTROS_POR_DEFECTO.x };
    case "y":
      return { y: FILTROS_POR_DEFECTO.y };
    case "metodo":
      return { metodo: FILTROS_POR_DEFECTO.metodo };
    case "top":
      return { top: FILTROS_POR_DEFECTO.top };
    default:
      return {};
  }
}
