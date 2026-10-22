import type { ResumenFuente } from "./types";
import { ETIQUETA_CONECTOR } from "./schemas/fuentes.schema";
import { fmtDateTimeUTC5, fmtTimeUTC5 } from "@/lib/format";

/* ════════════════════════════════════════════════════════════════
   Indicadores (KPI) del módulo "Fuentes de datos".

   Cada indicador describe qué mide, cómo se calcula y con qué tipo de
   gráfico se representa en la vista ampliada (pantalla completa).
   ════════════════════════════════════════════════════════════════ */

/** Métrica horaria que acompaña a cada indicador en la vista ampliada. */
export type MetricaHora = "ejecuciones" | "fallidas" | "latenciaMedia" | "pctExito" | "insertados" | "duplicados";

/** Tipo de gráfico con el que se representa el indicador. */
export type TipoGrafico = "bar" | "area" | "hbar";

export interface KpiDef {
  etiqueta: string;
  descripcion: string;
  calculo: string;
  detalle: string;
  valor: (r: ResumenFuente) => string;
  metrica: MetricaHora;
  unidad: string;
  grafico: TipoGrafico;
  tituloGrafico: string;
}

export const KPIS: KpiDef[] = [
  {
    etiqueta: "Estado del conector",
    descripcion: "Salud operativa del conector con el proveedor.",
    calculo: "Se deriva de las últimas 8 ejecuciones finalizadas: sin conexión si la última falló; degradado si alguna falló o si la última descartó registros inválidos; operativo si no hubo incidencias.",
    detalle: "Salud del conector",
    valor: (r) => ETIQUETA_CONECTOR[r.estadoConector],
    metrica: "fallidas",
    unidad: "fallos/h",
    grafico: "hbar",
    tituloGrafico: "Distribución de ejecuciones por estado",
  },
  {
    etiqueta: "Último éxito",
    descripcion: "Marca de la última ejecución correcta de la ingesta.",
    calculo: "Fecha y hora (UTC-5) de la ejecución más reciente con estado «Correcta». El gráfico muestra el ritmo de ingesta por hora.",
    detalle: "Última ingesta correcta",
    valor: (r) => fmtTimeUTC5(r.ultimoExitoUtc),
    metrica: "ejecuciones",
    unidad: "ejecuciones/h",
    grafico: "area",
    tituloGrafico: "Ejecuciones por hora",
  },
  {
    etiqueta: "Latencia media",
    descripcion: "Tiempo medio de respuesta del proveedor.",
    calculo: "Promedio de la latencia (ms) de las ejecuciones finalizadas que respondieron; excluye las fallidas por timeout.",
    detalle: "Ejecuciones completadas",
    valor: (r) => `${r.latenciaMediaMs} ms`,
    metrica: "latenciaMedia",
    unidad: "ms",
    grafico: "area",
    tituloGrafico: "Latencia media por hora",
  },
  {
    etiqueta: "Tasa de éxito",
    descripcion: "Proporción de ejecuciones sin fallo total.",
    calculo: "Ejecuciones «Correcta» + «Con errores» sobre el total de ejecuciones finalizadas de la ventana. La línea punteada marca el objetivo del 95 %.",
    detalle: "Sobre ejecuciones finalizadas",
    valor: (r) => `${r.tasaExitoPct.toFixed(1)}%`,
    metrica: "pctExito",
    unidad: "%",
    grafico: "bar",
    tituloGrafico: "Tasa de éxito por hora",
  },
  {
    etiqueta: "Registros insertados",
    descripcion: "Eventos nuevos efectivamente cargados.",
    calculo: "Suma de registros insertados en todas las ejecuciones de la ventana, tras deduplicar.",
    detalle: "Últimas 12 h",
    valor: (r) => r.registrosInsertados.toLocaleString("es-PE"),
    metrica: "insertados",
    unidad: "registros/h",
    grafico: "bar",
    tituloGrafico: "Registros insertados por hora",
  },
  {
    etiqueta: "Duplicados omitidos",
    descripcion: "Eventos ya presentes que no se volvieron a cargar.",
    calculo: "Suma de duplicados omitidos: eventos cuya huella de origen ya existía (ingesta idempotente). Las barras comparan con los insertados.",
    detalle: "Deduplicación por hash de origen",
    valor: (r) => r.duplicadosOmitidos.toLocaleString("es-PE"),
    metrica: "duplicados",
    unidad: "registros/h",
    grafico: "bar",
    tituloGrafico: "Duplicados omitidos por hora",
  },
];

/** Sección ampliable del módulo (KPI, ficha, gráfico o pestaña). */
export type SeccionFuente =
  | `kpi-${number}`
  | "conector"
  | "latencia"
  | "ejecuciones"
  | "calidad"
  | "registro"
  | "configuracion";

/** Fecha/hora legible del último éxito (UTC-5) para las tarjetas. */
export function detalleUltimoExito(r: ResumenFuente): string {
  return `${fmtDateTimeUTC5(r.ultimoExitoUtc)} (UTC-5)`;
}
