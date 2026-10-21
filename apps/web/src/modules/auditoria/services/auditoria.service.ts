import { apiGet } from "@/lib/api";
import type { Facetas, FiltrosAuditoria, PaginaAuditoria } from "../types";
import { limiteDia } from "../schemas/auditoria.schema";

/* ════════════════════════════════════════════════════════════════
   Acceso a datos del módulo "Auditoría". SIEMPRE contra la API (solo lectura):

     GET /api/v1/audit-logs?actor_id&action&entity_type&entity_id&from&to&page&page_size
     GET /api/v1/audit-logs/facets   → valores para los filtros
     GET /api/v1/audit-logs/export   → CSV (la exportación queda auditada)
   ════════════════════════════════════════════════════════════════ */

function consulta(f: FiltrosAuditoria): URLSearchParams {
  const qs = new URLSearchParams();
  if (f.actor_id) qs.set("actor_id", f.actor_id);
  if (f.action) qs.set("action", f.action);
  if (f.entity_type) qs.set("entity_type", f.entity_type);
  if (f.entity_id.trim()) qs.set("entity_id", f.entity_id.trim());
  if (f.desde) qs.set("from", limiteDia(f.desde, false));
  if (f.hasta) qs.set("to", limiteDia(f.hasta, true));
  return qs;
}

export function listarAuditoria(f: FiltrosAuditoria, pagina: number, tamano: number): Promise<PaginaAuditoria> {
  const qs = consulta(f);
  qs.set("page", String(pagina));
  qs.set("page_size", String(tamano));
  return apiGet<PaginaAuditoria>(`/audit-logs?${qs.toString()}`);
}

export function obtenerFacetas(): Promise<Facetas> {
  return apiGet<Facetas>("/audit-logs/facets");
}

/** CSV de lo filtrado (texto). El BOM se vuelve a añadir al descargar para Excel. */
export function exportarAuditoria(f: FiltrosAuditoria): Promise<string> {
  return apiGet<string>(`/audit-logs/export?${consulta(f).toString()}`);
}
