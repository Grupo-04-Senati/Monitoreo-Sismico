/* Tipos del módulo "Auditoría" (PDF §6.13). Reflejan la API `/api/v1/audit-logs`
   (ver `services/api/app/schemas/auditoria.py`). */

export interface RegistroAuditoria {
  id: string;
  actor_id: string | null;
  /** Nombre y correo actuales; null si fue el sistema o la cuenta ya no existe. */
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_json: Record<string, unknown> | null;
  after_json: Record<string, unknown> | null;
  occurred_at: string;
  correlation_id: string | null;
}

export interface PaginaAuditoria {
  items: RegistroAuditoria[];
  total: number;
  page: number;
  page_size: number;
}

export interface ActorFaceta {
  id: string;
  nombre: string | null;
  email: string | null;
}

export interface Facetas {
  acciones: string[];
  entidades: string[];
  actores: ActorFaceta[];
  total: number;
  mas_antiguo: string | null;
}

export interface FiltrosAuditoria {
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  /** Días en formato AAAA-MM-DD (se interpretan en UTC-5). */
  desde: string;
  hasta: string;
}
