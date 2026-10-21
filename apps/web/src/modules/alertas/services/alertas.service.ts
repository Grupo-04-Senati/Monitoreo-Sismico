import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { Aviso, FiltrosAvisos, PaginaAvisos, Regla, ReglaIn, Simulacion } from "../types";

/* ════════════════════════════════════════════════════════════════
   Acceso a datos de "Reglas de alertas" y "Centro de alertas". SIEMPRE contra la API:

     GET  /api/v1/alert-rules                  → reglas
     POST /api/v1/alert-rules                  → crear (nace inactiva)
     PUT  /api/v1/alert-rules/{id}             → editar (solo inactiva)
     POST /api/v1/alert-rules/simulate         → simulación retrospectiva (no crea nada)
     POST /api/v1/alert-rules/{id}/activate    → solo Administrador
     POST /api/v1/alert-rules/{id}/deactivate
     GET  /api/v1/alerts?estado&severidad&regla&page&page_size
     GET  /api/v1/alerts/{id}
     POST /api/v1/alerts/{id}/approve|cancel|acknowledge|retry
   ════════════════════════════════════════════════════════════════ */

export async function listarReglas(): Promise<Regla[]> {
  return (await apiGet<{ items: Regla[] }>("/alert-rules")).items;
}

export function crearRegla(regla: ReglaIn): Promise<Regla> {
  return apiPost<Regla>("/alert-rules", regla);
}

export function editarRegla(id: string, regla: ReglaIn): Promise<Regla> {
  return apiPut<Regla>(`/alert-rules/${encodeURIComponent(id)}`, regla);
}

export function cambiarEstadoRegla(id: string, activar: boolean): Promise<Regla> {
  return apiPost<Regla>(`/alert-rules/${encodeURIComponent(id)}/${activar ? "activate" : "deactivate"}`);
}

export function simularRegla(regla: ReglaIn, dias: number): Promise<Simulacion> {
  return apiPost<Simulacion>("/alert-rules/simulate", { regla, dias });
}

export function listarAvisos(filtros: FiltrosAvisos, pagina: number, tamano: number): Promise<PaginaAvisos> {
  const qs = new URLSearchParams({ page: String(pagina), page_size: String(tamano) });
  if (filtros.estado) qs.set("estado", filtros.estado);
  if (filtros.severidad) qs.set("severidad", filtros.severidad);
  if (filtros.regla) qs.set("regla", filtros.regla);
  return apiGet<PaginaAvisos>(`/alerts?${qs.toString()}`);
}

/** Total de avisos con un estado (sin traer filas). */
export async function contarAvisos(estado: FiltrosAvisos["estado"]): Promise<number> {
  return (await listarAvisos({ estado, severidad: "", regla: "" }, 1, 1)).total;
}

export function obtenerAviso(id: string): Promise<Aviso> {
  return apiGet<Aviso>(`/alerts/${encodeURIComponent(id)}`);
}

export type AccionAviso = "approve" | "acknowledge" | "retry";

export function actuarAviso(id: string, accion: AccionAviso): Promise<Aviso> {
  return apiPost<Aviso>(`/alerts/${encodeURIComponent(id)}/${accion}`);
}

export function cancelarAviso(id: string, motivo: string): Promise<Aviso> {
  return apiPost<Aviso>(`/alerts/${encodeURIComponent(id)}/cancel`, { motivo });
}
