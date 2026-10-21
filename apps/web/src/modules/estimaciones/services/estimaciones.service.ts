import { apiGet, apiPost } from "@/lib/api";
import type { ModeloAprobado } from "@/modules/modelos-ml/types";
import type { EstadoEstimacion, Estimacion, ModeloOpcion, PaginaEstimaciones } from "../types";

/* ════════════════════════════════════════════════════════════════
   Acceso a datos del módulo "Estimaciones experimentales". SIEMPRE contra la API:

     GET  /api/v1/estimates?estado&page&page_size  → lista paginada (+ advertencia)
     POST /api/v1/estimates                        → generar (modelo aprobado)
     GET  /api/v1/estimates/{id}                   → detalle
     POST /api/v1/estimates/{id}/publish|withdraw  → revisión (solo Administrador)
     GET  /api/v1/ml/models                        → modelos aprobados para el formulario
   ════════════════════════════════════════════════════════════════ */

export function listarEstimaciones(estado: EstadoEstimacion | "", pagina: number, tamano: number): Promise<PaginaEstimaciones> {
  const qs = new URLSearchParams({ page: String(pagina), page_size: String(tamano) });
  if (estado) qs.set("estado", estado);
  return apiGet<PaginaEstimaciones>(`/estimates?${qs.toString()}`);
}

export function generarEstimacion(modelId: string): Promise<Estimacion> {
  return apiPost<Estimacion>("/estimates", { model_id: modelId });
}

export function obtenerEstimacion(id: string): Promise<Estimacion> {
  return apiGet<Estimacion>(`/estimates/${encodeURIComponent(id)}`);
}

export function revisarEstimacion(id: string, accion: "publish" | "withdraw"): Promise<Estimacion> {
  return apiPost<Estimacion>(`/estimates/${encodeURIComponent(id)}/${accion}`);
}

/** Solo los modelos aprobados de conteo semanal pueden estimar. */
export async function modelosParaEstimar(): Promise<ModeloOpcion[]> {
  const { items } = await apiGet<{ items: ModeloAprobado[] }>("/ml/models");
  return items
    .filter((m) => m.task_type === "conteo_semanal" && m.status === "aprobado")
    .map((m) => ({ id: m.id, etiqueta: `${m.name} · v${m.version}` }));
}
