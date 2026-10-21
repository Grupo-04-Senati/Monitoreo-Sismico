import { apiGet, apiPost } from "@/lib/api";
import type { PaginaDatasets } from "@/modules/preparacion-datos/types";
import type { DatasetOpcion, EstadoExperimento, Experimento, ModeloAprobado, NuevoExperimento, PaginaExperimentos } from "../types";

/* ════════════════════════════════════════════════════════════════
   Acceso a datos del módulo "Modelos ML". SIEMPRE contra la API:

     GET  /api/v1/ml/experiments?estado&page&page_size  → lista paginada
     POST /api/v1/ml/experiments                        → entrena (dataset aprobado)
     GET  /api/v1/ml/experiments/{id}                   → detalle
     GET  /api/v1/ml/models                             → modelos aprobados
     POST /api/v1/ml/models/{experiment_id}/approve     → aprobar (solo Administrador)
     GET  /api/v1/datasets?estado=aprobado              → datasets para el formulario
   ════════════════════════════════════════════════════════════════ */

export function listarExperimentos(estado: EstadoExperimento | "", pagina: number, tamano: number): Promise<PaginaExperimentos> {
  const qs = new URLSearchParams({ page: String(pagina), page_size: String(tamano) });
  if (estado) qs.set("estado", estado);
  return apiGet<PaginaExperimentos>(`/ml/experiments?${qs.toString()}`);
}

export function crearExperimento(cuerpo: NuevoExperimento): Promise<Experimento> {
  return apiPost<Experimento>("/ml/experiments", cuerpo);
}

export function obtenerExperimento(id: string): Promise<Experimento> {
  return apiGet<Experimento>(`/ml/experiments/${encodeURIComponent(id)}`);
}

export async function listarModelos(): Promise<ModeloAprobado[]> {
  return (await apiGet<{ items: ModeloAprobado[] }>("/ml/models")).items;
}

export function aprobarModelo(experimentId: string, limitaciones: string | null): Promise<ModeloAprobado> {
  return apiPost<ModeloAprobado>(`/ml/models/${encodeURIComponent(experimentId)}/approve`, {
    limitaciones: limitaciones?.trim() || null,
  });
}

/** Datasets aprobados (los únicos con los que se puede entrenar). */
export async function datasetsAprobados(): Promise<DatasetOpcion[]> {
  const { items } = await apiGet<PaginaDatasets>("/datasets?estado=aprobado&page=1&page_size=200");
  return items.map((d) => ({
    id: d.id,
    etiqueta: `${d.name} · v${d.version} (${d.row_count.toLocaleString("es-PE")} filas)`,
    tieneCorte: d.split_date != null,
    tieneObjetivo: d.target_name != null,
  }));
}
