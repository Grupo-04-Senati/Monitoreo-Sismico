import type { EstadoRevision } from "@/types";
import type {
  ChipFiltro,
  EstadoReporte,
  FiltrosReportes,
  FormatoReporte,
  OpcionFiltro,
  ParametrosReporte,
  PeriodoReporte,
  TipoReporte,
  TipoReporteInfo,
} from "../types";

/* ════════════════════════════════════════════════════════════════
   Contrato del módulo "Reportes": catálogo de tipos y formatos, etiquetas y
   colores de estado, periodo de corte, valores por defecto, traducción entre
   el estado y la URL, y validación del formulario de solicitud.
   ════════════════════════════════════════════════════════════════ */

/** Horas que vive el enlace de descarga antes de expirar (igual que la API). */
export const TTL_HORAS = 24;
/** Un enlace se resalta como "por expirar" cuando le quedan menos de estas horas. */
export const UMBRAL_POR_EXPIRAR_HORAS = 6;

export const TAMANO_POR_DEFECTO = 10;
export const TAMANOS_PAGINA = [5, 10, 25] as const;
export const SOLICITANTE_POR_DEFECTO = "";

export const TIPOS: TipoReporteInfo[] = [
  {
    tipo: "eventos",
    nombre: "Eventos sísmicos",
    descripcion: "Catálogo de eventos observados con fecha de corte, filtros y estado de revisión.",
    disponible: true,
  },
  {
    tipo: "calidad_datos",
    nombre: "Calidad de datos",
    descripcion: "Métricas de la ingesta: registros leídos, insertados, duplicados y latencia por ejecución.",
    disponible: true,
  },
  {
    tipo: "fuentes_ingesta",
    nombre: "Fuentes e ingesta",
    descripcion: "Ficha del conector y parámetros de la ingesta (sin credenciales ni secretos).",
    disponible: true,
  },
  {
    tipo: "modelos",
    nombre: "Modelos ML",
    descripcion: "Resultados de los modelos de estimación. Depende del módulo de Modelos ML.",
    disponible: false,
  },
  {
    tipo: "alertas",
    nombre: "Alertas",
    descripcion: "Historial de reglas y alertas emitidas. Depende del centro de alertas.",
    disponible: false,
  },
];

export const ETIQUETA_TIPO: Record<TipoReporte, string> = {
  eventos: "Eventos sísmicos",
  calidad_datos: "Calidad de datos",
  fuentes_ingesta: "Fuentes e ingesta",
  modelos: "Modelos ML",
  alertas: "Alertas",
};

export function tipoDisponible(tipo: TipoReporte): boolean {
  return TIPOS.find((t) => t.tipo === tipo)?.disponible ?? false;
}

export function infoTipo(tipo: TipoReporte): TipoReporteInfo | undefined {
  return TIPOS.find((t) => t.tipo === tipo);
}

/* ════ Formatos ════ */

export const FORMATOS: { value: FormatoReporte; label: string; detalle: string; requierePdf: boolean }[] = [
  { value: "xlsx", label: "Excel (.xlsx)", detalle: "Tabla con cabecera y metadatos del informe.", requierePdf: false },
  { value: "csv", label: "CSV (.csv)", detalle: "Texto plano delimitado por punto y coma.", requierePdf: false },
  { value: "pdf", label: "PDF (.pdf)", detalle: "Documento de lectura con la tabla y su cabecera.", requierePdf: true },
];

export function formatoLabel(f: FormatoReporte): string {
  return FORMATOS.find((x) => x.value === f)?.label ?? f;
}

/* ════ Periodos (fecha de corte) ════ */

export const PERIODOS: OpcionFiltro[] = [
  { value: "24h", label: "Últimas 24 h" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "90d", label: "Últimos 90 días" },
  { value: "personalizado", label: "Rango personalizado" },
];

/* ════ Estados ════ */

export const ESTADOS_REPORTE: EstadoReporte[] = ["pendiente", "en_proceso", "listo", "fallido", "expirado"];

export const ETIQUETA_ESTADO: Record<EstadoReporte, string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  listo: "Listo",
  fallido: "Fallido",
  expirado: "Expirado",
};

/** Símbolo textual del estado (sin semáforo). */
export const SIMBOLO_ESTADO: Record<EstadoReporte, string> = {
  pendiente: "○",
  en_proceso: "◐",
  listo: "●",
  fallido: "✕",
  expirado: "—",
};

export const COLOR_ESTADO: Record<EstadoReporte, string> = {
  pendiente: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  en_proceso: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  listo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  fallido: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  expirado: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

/** Color de la barra del gráfico por estado (misma familia que la insignia). */
export const BARRA_ESTADO: Record<EstadoReporte, string> = {
  pendiente: "bg-slate-400",
  en_proceso: "bg-cyan-500",
  listo: "bg-emerald-600",
  fallido: "bg-rose-600",
  expirado: "bg-slate-300",
};

export const OPCIONES_ESTADO: OpcionFiltro[] = [
  { value: "", label: "Todos los estados" },
  ...ESTADOS_REPORTE.map((e) => ({ value: e, label: ETIQUETA_ESTADO[e] })),
];

export const OPCIONES_TIPO: OpcionFiltro[] = [
  { value: "", label: "Todos los tipos" },
  ...TIPOS.map((t) => ({ value: t.tipo, label: t.nombre })),
];

/* ════ Valores por defecto ════ */

export const TIPO_POR_DEFECTO: TipoReporte = "eventos";
export const FORMATO_POR_DEFECTO: FormatoReporte = "xlsx";
export const PERIODO_POR_DEFECTO: PeriodoReporte = "30d";

export function parametrosIniciales(): ParametrosReporte {
  return {
    tipo: TIPO_POR_DEFECTO,
    formato: FORMATO_POR_DEFECTO,
    periodo: PERIODO_POR_DEFECTO,
    desde: "",
    hasta: "",
    zona: "",
    magnitudMin: null,
    reviewStatus: "",
  };
}

export function filtrosIniciales(): FiltrosReportes {
  return { tipo: "", estado: "", solicitante: SOLICITANTE_POR_DEFECTO };
}

/* ════ Validación del formulario ════ */

export interface ResultadoValidacion {
  ok: boolean;
  error?: string;
}

export function validarParametros(p: ParametrosReporte, puedePdf: boolean): ResultadoValidacion {
  if (!tipoDisponible(p.tipo)) {
    return { ok: false, error: "Ese tipo de informe estará disponible próximamente." };
  }
  if (p.formato === "pdf" && !puedePdf) {
    return { ok: false, error: "Tu rol no permite exportar en PDF." };
  }
  if (p.periodo === "personalizado") {
    if (!p.desde || !p.hasta) return { ok: false, error: "Indica la fecha inicial y final del rango." };
    if (p.desde > p.hasta) return { ok: false, error: "La fecha inicial no puede ser posterior a la final." };
  }
  return { ok: true };
}

/* ════ URL ⇄ estado ════ */

function esTipo(v: string | null): v is TipoReporte {
  return v === "eventos" || v === "calidad_datos" || v === "fuentes_ingesta" || v === "modelos" || v === "alertas";
}

function esEstadoReporte(v: string | null): v is EstadoReporte {
  return v !== null && (ESTADOS_REPORTE as string[]).includes(v);
}

export function filtrosReportesDesdeParams(params: URLSearchParams): FiltrosReportes {
  const tipo = params.get("tipo");
  const estado = params.get("estado");
  const solicitante = params.get("sol");
  return {
    tipo: esTipo(tipo) ? tipo : "",
    estado: esEstadoReporte(estado) ? estado : "",
    solicitante: solicitante ?? SOLICITANTE_POR_DEFECTO,
  };
}

export function paginaDesdeParams(params: URLSearchParams): number {
  const n = Number(params.get("pag"));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function tamanoDesdeParams(params: URLSearchParams): number {
  const n = Number(params.get("tam"));
  return (TAMANOS_PAGINA as readonly number[]).includes(n) ? n : TAMANO_POR_DEFECTO;
}

export function chipsReportes(f: FiltrosReportes, nombreSolicitante: string): ChipFiltro[] {
  const chips: ChipFiltro[] = [];
  if (f.tipo) chips.push({ clave: "tipo", etiqueta: `Tipo: ${ETIQUETA_TIPO[f.tipo]}` });
  if (f.estado) chips.push({ clave: "estado", etiqueta: `Estado: ${ETIQUETA_ESTADO[f.estado]}` });
  if (f.solicitante === "mios") chips.push({ clave: "sol", etiqueta: "Solicitante: mis informes" });
  else if (f.solicitante) chips.push({ clave: "sol", etiqueta: `Solicitante: ${nombreSolicitante || f.solicitante}` });
  return chips;
}

/* ════ Zona (una sola: todas las regiones del catálogo) ════ */

export type ZonaOption = { slug: string; name: string };

export function etiquetaZona(zona: string, zonas: ZonaOption[]): string {
  if (!zona) return "Todas las regiones";
  return zonas.find((z) => z.slug === zona)?.name ?? zona;
}

export const ESTADOS_REVISION: { value: "" | EstadoRevision; label: string }[] = [
  { value: "", label: "Todos los estados" },
  { value: "observado", label: "Observado" },
  { value: "pendiente_validacion", label: "Pendiente de validación" },
];
