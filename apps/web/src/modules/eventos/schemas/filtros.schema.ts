import type {
  CampoOrdenEventos,
  ChipFiltro,
  EstadoRevision,
  FiltrosEventos,
  OpcionFiltro,
  OrdenEventos,
  TipoMagnitudFiltro,
} from "../types";
import { REGION_OPTIONS, periodLabel } from "@/lib/catalogo";

/* ════════════════════════════════════════════════════════════════
   Contrato de filtros del módulo de Eventos sísmicos:
   valores por defecto, opciones de la barra, validación y traducción
   entre filtros y los parámetros de la URL (fuente de la verdad).
   ════════════════════════════════════════════════════════════════ */

export const PERIODO_POR_DEFECTO = "30d";
export const TAMANO_POR_DEFECTO = 10;
export const ORDEN_POR_DEFECTO: OrdenEventos = { campo: "fecha", direccion: "desc" };
export const LIMITES_MAGNITUD = { min: 2, max: 7 } as const;
export const LIMITES_PROFUNDIDAD = { min: 0, max: 750 } as const;
export const TAMANOS_PAGINA = [10, 25, 50] as const;

/** Opciones del filtro por tipo de magnitud (incluye "sin tipo"). */
export const TIPOS_MAGNITUD: OpcionFiltro[] = [
  { value: "", label: "Todos los tipos" },
  { value: "Mw", label: "Mw (momento)" },
  { value: "ML", label: "ML (local)" },
  { value: "mb", label: "mb (ondas de cuerpo)" },
  { value: "none", label: "Sin tipo informado" },
];

export const ETIQUETA_TIPO: Record<Exclude<TipoMagnitudFiltro, "">, string> = {
  Mw: "Mw",
  ML: "ML",
  mb: "mb",
  none: "Sin tipo",
};

export const PERIODOS: OpcionFiltro[] = [
  { value: "24h", label: "24 h" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "custom", label: "Rango" },
];

export const ESTADOS: OpcionFiltro[] = [
  { value: "", label: "Todos los estados" },
  { value: "observado", label: "Observado" },
  { value: "pendiente_validacion", label: "Pendiente de validación" },
];

export const ETIQUETA_ESTADO: Record<EstadoRevision, string> = {
  observado: "Observado",
  pendiente_validacion: "Pendiente de validación",
};

export const CAMPOS_ORDEN: CampoOrdenEventos[] = [
  "fecha",
  "localidad",
  "region",
  "magnitud",
  "profundidad",
  "estado",
  "id",
  "latitud",
  "longitud",
];

/** Columnas opcionales que el usuario puede mostrar/ocultar en la tabla. */
export const COLUMNAS_OPCIONALES: OpcionFiltro[] = [
  { value: "id", label: "ID" },
  { value: "latitud", label: "Latitud" },
  { value: "longitud", label: "Longitud" },
];

export const CLAVES_COLUMNAS: string[] = COLUMNAS_OPCIONALES.map((c) => c.value);

export const REGIONES: OpcionFiltro[] = REGION_OPTIONS.map((r) => ({ value: r.slug, label: r.name }));

/* ════ Validación ════ */

export interface ErroresFiltros {
  desde?: string;
  hasta?: string;
  magnitud?: string;
  profundidad?: string;
}

/** Valida mín ≤ máx (fechas, magnitud y profundidad). El error se muestra junto al campo. */
export function validarFiltros(f: FiltrosEventos): ErroresFiltros {
  const errores: ErroresFiltros = {};
  if (f.periodo === "custom" && f.desde && f.hasta && f.desde > f.hasta) {
    errores.hasta = "La fecha final no puede ser anterior a la inicial.";
  }
  if (f.magnitudMin != null && f.magnitudMax != null && f.magnitudMin > f.magnitudMax) {
    errores.magnitud = "La magnitud mínima no puede ser mayor que la máxima.";
  }
  if (f.profundidadMin != null && f.profundidadMax != null && f.profundidadMin > f.profundidadMax) {
    errores.profundidad = "La profundidad mínima no puede ser mayor que la máxima.";
  }
  return errores;
}

export function hayFiltrosActivos(f: FiltrosEventos): boolean {
  return (
    f.periodo !== PERIODO_POR_DEFECTO ||
    Boolean(f.desde) ||
    Boolean(f.hasta) ||
    Boolean(f.region) ||
    f.magnitudMin != null ||
    f.magnitudMax != null ||
    Boolean(f.magnitudTipo) ||
    f.profundidadMin != null ||
    f.profundidadMax != null ||
    Boolean(f.q) ||
    Boolean(f.estado)
  );
}

/* ════ URL ⇄ filtros ════ */

function numeroOParcial(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lee los filtros de la URL. Acepta los alias del Dashboard (`zona`, `magmin`,
 * `magmax`) para que sus enlaces profundos lleguen con los filtros aplicados.
 */
export function filtrosDesdeParams(params: URLSearchParams): FiltrosEventos {
  const estadoParam = params.get("estado");
  const estado: FiltrosEventos["estado"] =
    estadoParam === "observado" || estadoParam === "pendiente_validacion" ? estadoParam : "";
  return {
    periodo: params.get("periodo") || PERIODO_POR_DEFECTO,
    desde: params.get("desde") ?? "",
    hasta: params.get("hasta") ?? "",
    region: params.get("region") ?? params.get("zona") ?? "",
    magnitudMin: numeroOParcial(params.get("magnitudMin") ?? params.get("magmin")),
    magnitudMax: numeroOParcial(params.get("magnitudMax") ?? params.get("magmax")),
    magnitudTipo: tipoValido(params.get("tipo")),
    profundidadMin: numeroOParcial(params.get("profMin")),
    profundidadMax: numeroOParcial(params.get("profMax")),
    q: params.get("q") ?? "",
    estado,
  };
}

/** Valida el parámetro de tipo de magnitud contra las opciones admitidas. */
function tipoValido(valor: string | null): TipoMagnitudFiltro {
  return valor === "Mw" || valor === "ML" || valor === "mb" || valor === "none" ? valor : "";
}

/** Serializa solo los filtros (sin orden ni paginación). */
export function filtrosAParams(f: FiltrosEventos): URLSearchParams {
  const p = new URLSearchParams();
  p.set("periodo", f.periodo || PERIODO_POR_DEFECTO);
  if (f.periodo === "custom") {
    if (f.desde) p.set("desde", f.desde);
    if (f.hasta) p.set("hasta", f.hasta);
  }
  if (f.region) p.set("region", f.region);
  if (f.magnitudMin != null) p.set("magnitudMin", String(f.magnitudMin));
  if (f.magnitudMax != null) p.set("magnitudMax", String(f.magnitudMax));
  if (f.magnitudTipo) p.set("tipo", f.magnitudTipo);
  if (f.profundidadMin != null) p.set("profMin", String(f.profundidadMin));
  if (f.profundidadMax != null) p.set("profMax", String(f.profundidadMax));
  if (f.q) p.set("q", f.q);
  if (f.estado) p.set("estado", f.estado);
  return p;
}

export function ordenDesdeParams(params: URLSearchParams): OrdenEventos {
  const campo = params.get("orden") ?? "";
  const dir = params.get("dir");
  return {
    campo: (CAMPOS_ORDEN as string[]).includes(campo) ? (campo as CampoOrdenEventos) : ORDEN_POR_DEFECTO.campo,
    direccion: dir === "asc" ? "asc" : "desc",
  };
}

export function tamanoDesdeParams(params: URLSearchParams): number {
  const n = Number(params.get("tamano"));
  return (TAMANOS_PAGINA as readonly number[]).includes(n) ? n : TAMANO_POR_DEFECTO;
}

export function paginaDesdeParams(params: URLSearchParams): number {
  const n = Number(params.get("pagina"));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

/** Columnas opcionales visibles (`?cols=id,latitud`). */
export function columnasDesdeParams(params: URLSearchParams): string[] {
  const raw = params.get("cols");
  if (!raw) return [];
  const pedidas = raw.split(",");
  return CLAVES_COLUMNAS.filter((c) => pedidas.includes(c));
}

/** Serializa las columnas visibles conservando el orden canónico. */
export function columnasAValor(columnas: string[]): string {
  return CLAVES_COLUMNAS.filter((c) => columnas.includes(c)).join(",");
}

/* ════ Etiquetas para los chips y el pie ════ */

export function nombreRegion(slug: string): string {
  return REGIONES.find((r) => r.value === slug)?.label ?? slug;
}

export function chipsDesdeFiltros(f: FiltrosEventos): ChipFiltro[] {
  const chips: ChipFiltro[] = [];
  if (f.periodo !== PERIODO_POR_DEFECTO || f.desde || f.hasta) {
    chips.push({ clave: "periodo", etiqueta: `Periodo: ${periodLabel(f.periodo, f.desde, f.hasta)}` });
  }
  if (f.region) chips.push({ clave: "region", etiqueta: `Región: ${nombreRegion(f.region)}` });
  if (f.magnitudMin != null) chips.push({ clave: "magnitudMin", etiqueta: `Magnitud ≥ ${f.magnitudMin.toFixed(1)}` });
  if (f.magnitudMax != null) chips.push({ clave: "magnitudMax", etiqueta: `Magnitud ≤ ${f.magnitudMax.toFixed(1)}` });
  if (f.magnitudTipo) chips.push({ clave: "magnitudTipo", etiqueta: `Tipo: ${ETIQUETA_TIPO[f.magnitudTipo]}` });
  if (f.profundidadMin != null) chips.push({ clave: "profundidadMin", etiqueta: `Profundidad ≥ ${f.profundidadMin} km` });
  if (f.profundidadMax != null) chips.push({ clave: "profundidadMax", etiqueta: `Profundidad ≤ ${f.profundidadMax} km` });
  if (f.q) chips.push({ clave: "q", etiqueta: `Buscar: “${f.q}”` });
  if (f.estado) chips.push({ clave: "estado", etiqueta: `Estado: ${ETIQUETA_ESTADO[f.estado]}` });
  return chips;
}

/** Filtros que se restauran al quitar un chip. */
export function filtroSinChip(clave: string): Partial<FiltrosEventos> {
  switch (clave) {
    case "periodo":
      return { periodo: PERIODO_POR_DEFECTO, desde: "", hasta: "" };
    case "region":
      return { region: "" };
    case "magnitudMin":
      return { magnitudMin: null };
    case "magnitudMax":
      return { magnitudMax: null };
    case "magnitudTipo":
      return { magnitudTipo: "" };
    case "profundidadMin":
      return { profundidadMin: null };
    case "profundidadMax":
      return { profundidadMax: null };
    case "q":
      return { q: "" };
    case "estado":
      return { estado: "" };
    default:
      return {};
  }
}

/** Resumen de una línea para el pie de la tabla. */
export function resumenFiltros(f: FiltrosEventos): string {
  const partes: string[] = [periodLabel(f.periodo, f.desde, f.hasta)];
  partes.push(f.region ? nombreRegion(f.region) : "Todo el Perú");
  if (f.magnitudMin != null || f.magnitudMax != null) {
    const lo = f.magnitudMin != null ? f.magnitudMin.toFixed(1) : "—";
    const hi = f.magnitudMax != null ? f.magnitudMax.toFixed(1) : "—";
    partes.push(`mag. ${lo}–${hi}`);
  }
  if (f.magnitudTipo) partes.push(`tipo ${ETIQUETA_TIPO[f.magnitudTipo]}`);
  if (f.profundidadMin != null || f.profundidadMax != null) {
    const lo = f.profundidadMin != null ? `${f.profundidadMin}` : "—";
    const hi = f.profundidadMax != null ? `${f.profundidadMax}` : "—";
    partes.push(`prof. ${lo}–${hi} km`);
  }
  if (f.q) partes.push(`búsqueda “${f.q}”`);
  if (f.estado) partes.push(ETIQUETA_ESTADO[f.estado]);
  return partes.join(" · ");
}
