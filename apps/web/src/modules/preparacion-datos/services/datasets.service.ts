import { apiGet, apiPost } from "@/lib/api";
import type { Dataset, EstadoDataset, FuenteOpcion, NuevoDataset, PaginaDatasets, PaginaFilas, Particion } from "../types";

/* ════════════════════════════════════════════════════════════════
   Acceso a datos del módulo "Preparación de datos". SIEMPRE contra la API:

     GET  /api/v1/datasets?estado&page&page_size   → lista paginada
     POST /api/v1/datasets                         → nueva versión (informe incluido)
     GET  /api/v1/datasets/{id}                    → detalle
     GET  /api/v1/datasets/{id}/rows?split&page    → vista previa (imputación marcada)
     POST /api/v1/datasets/{id}/approve            → aprobar (solo Administrador)
     GET  /api/v1/sources                          → fuentes para el formulario
   ════════════════════════════════════════════════════════════════ */

export function listarDatasets(estado: EstadoDataset | "", pagina: number, tamano: number): Promise<PaginaDatasets> {
  const qs = new URLSearchParams({ page: String(pagina), page_size: String(tamano) });
  if (estado) qs.set("estado", estado);
  return apiGet<PaginaDatasets>(`/datasets?${qs.toString()}`);
}

export function crearDataset(cuerpo: NuevoDataset): Promise<Dataset> {
  return apiPost<Dataset>("/datasets", cuerpo);
}

export function obtenerDataset(id: string): Promise<Dataset> {
  return apiGet<Dataset>(`/datasets/${encodeURIComponent(id)}`);
}

export function filasDataset(id: string, split: Particion | "", pagina: number, tamano: number): Promise<PaginaFilas> {
  const qs = new URLSearchParams({ page: String(pagina), page_size: String(tamano) });
  if (split) qs.set("split", split);
  return apiGet<PaginaFilas>(`/datasets/${encodeURIComponent(id)}/rows?${qs.toString()}`);
}

export function aprobarDataset(id: string): Promise<Dataset> {
  return apiPost<Dataset>(`/datasets/${encodeURIComponent(id)}/approve`);
}

export async function listarFuentes(): Promise<FuenteOpcion[]> {
  const { items } = await apiGet<{ items: FuenteOpcion[] }>("/sources");
  return items.map((f) => ({ key: f.key, name: f.name }));
}
