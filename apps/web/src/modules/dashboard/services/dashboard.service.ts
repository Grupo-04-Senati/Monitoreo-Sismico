import { apiGet } from "@/lib/api";
import type { SeismicEvent } from "@/types";
import { cargarCatalogo } from "@/modules/eventos/services/eventos.service";
import { desdeCatalogo } from "@/modules/analisis/services/analisis.service";

/* ════════════════════════════════════════════════════════════════
   Capa de acceso a datos del Dashboard. Todo contra la API real:
     GET /api/v1/dashboard/summary   (agregados SQL)
     GET /api/v1/events              (catálogo para KPIs y gráficos)
     GET /api/v1/sources             (fuentes configuradas)
     GET /api/v1/users               (nº de usuarios)
     GET /api/v1/reports             (nº de informes)
   ════════════════════════════════════════════════════════════════ */

export interface ResumenDashboard {
  total_events: number;
  recent_events: number;
  events_7d: number;
  events_30d: number;
  last_sync: string | null;
  active_sources: number;
  failed_runs: number;
  active_alerts: number | null;
  generated_at: string;
}

export interface FuenteResumen {
  total: number;
  habilitadas: number;
  nombre: string | null;
}

export async function cargarResumen(): Promise<ResumenDashboard> {
  return apiGet<ResumenDashboard>("/dashboard/summary");
}

/** Catálogo real de eventos adaptado al tipo compartido `SeismicEvent`. */
export async function cargarEventos(): Promise<SeismicEvent[]> {
  return (await cargarCatalogo()).map(desdeCatalogo);
}

export async function cargarFuentes(): Promise<FuenteResumen> {
  const { items } = await apiGet<{ items: { name: string; enabled: boolean }[] }>("/sources");
  return {
    total: items.length,
    habilitadas: items.filter((s) => s.enabled).length,
    nombre: items[0]?.name ?? null,
  };
}

export async function contarUsuarios(): Promise<number> {
  const { total } = await apiGet<{ total: number }>("/users?pagina=1&tamano=1");
  return total;
}

export async function contarReportes(): Promise<number> {
  const data = await apiGet<{ resumen: { total: number } }>("/reports?pagina=1&tamano=1");
  return data.resumen.total;
}
