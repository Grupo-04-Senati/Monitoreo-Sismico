import type { ResumenReportes } from "./types";

/* ════════════════════════════════════════════════════════════════
   Indicadores (KPI) del módulo "Reportes". Cada indicador es clicable: abre
   un modal con la lista de informes que representa.
   ════════════════════════════════════════════════════════════════ */

export type IdKpiReporte = "total" | "generados" | "enProceso" | "fallidos" | "porExpirar";

export interface KpiReporteDef {
  id: IdKpiReporte;
  etiqueta: string;
  descripcion: string;
  valor: (r: ResumenReportes) => string;
}

export const KPIS: KpiReporteDef[] = [
  {
    id: "total",
    etiqueta: "Informes totales",
    descripcion: "Todos los informes solicitados, en cualquier estado.",
    valor: (r) => r.total.toLocaleString("es-PE"),
  },
  {
    id: "generados",
    etiqueta: "Listos",
    descripcion: "Informes generados y con enlace de descarga vigente o expirado.",
    valor: (r) => r.generados.toLocaleString("es-PE"),
  },
  {
    id: "enProceso",
    etiqueta: "En proceso",
    descripcion: "Informes en cola o generándose en este momento.",
    valor: (r) => r.enProceso.toLocaleString("es-PE"),
  },
  {
    id: "fallidos",
    etiqueta: "Fallidos",
    descripcion: "Informes cuya generación no se pudo completar.",
    valor: (r) => r.fallidos.toLocaleString("es-PE"),
  },
  {
    id: "porExpirar",
    etiqueta: "Por expirar",
    descripcion: "Informes listos cuyo enlace caduca en las próximas horas.",
    valor: (r) => r.porExpirar.toLocaleString("es-PE"),
  },
];
