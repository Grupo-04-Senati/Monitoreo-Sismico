/* Tipos de "Reglas de alertas" (PDF §6.8) y "Centro de alertas" (§6.9). Reflejan la API
   `/api/v1/alert-rules` y `/api/v1/alerts` (ver `services/api/app/schemas/alertas.py`). */

export type Severidad = "informativa" | "importante" | "critica";
export type Canal = "app" | "email" | "sms";
/** Roles que pueden recibir el SMS de una regla (D31). */
export type RolSms = "admin" | "analyst" | "alert_operator" | "auditor" | "viewer";
export type TipoMagnitud = "Mw" | "ML" | "mb";
export type EstadoAviso = "pendiente_aprobacion" | "aprobada" | "enviada" | "fallida" | "cancelada" | "suprimida";
export type EstadoEntrega = "entregada" | "simulada" | "fallida";

export interface Condicion {
  magnitud_minima: number;
  profundidad_min_km?: number | null;
  profundidad_max_km?: number | null;
  solo_revisados?: boolean;
  tipos_magnitud?: TipoMagnitud[] | null;
}

export interface Zona {
  tipo: "todo" | "circulo";
  nombre?: string | null;
  lat?: number | null;
  lon?: number | null;
  radio_km?: number | null;
}

/** Cuerpo de crear, editar y simular una regla. */
export interface ReglaIn {
  name: string;
  description: string | null;
  condicion: Condicion;
  zona: Zona;
  severidad: Severidad;
  canales: Canal[];
  destinatarios: string[];
  roles_sms: RolSms[];
  cooldown_minutos: number;
  requiere_aprobacion: boolean;
  antiguedad_max_horas: number;
  /** Si se omite, el servidor usa su plantilla por defecto. */
  plantilla_titulo?: string;
  plantilla_mensaje?: string;
}

export interface Regla {
  id: string;
  name: string;
  description: string | null;
  condition_json: Condicion;
  zone_spec: Zona;
  severity: Severidad;
  channels: Canal[];
  recipients: string[];
  sms_roles?: RolSms[];
  cooldown_seconds: number;
  requires_approval: boolean;
  max_event_age_hours: number;
  title_template: string;
  message_template: string;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  approved_by: string | null;
  approved_at: string | null;
}

export interface EjemploSimulacion {
  event_id: string;
  occurred_at: string;
  magnitude: number | null;
  magnitude_type: string | null;
  depth_km: number | null;
  locality: string | null;
  distance_km: number | null;
  suprimida: boolean;
  titulo: string;
}

export interface Simulacion {
  dias: number;
  desde: string;
  eventos_evaluados: number;
  coincidencias: number;
  alertas: number;
  suprimidas_por_cooldown: number;
  ejemplos: EjemploSimulacion[];
  nota: string;
}

export interface Entrega {
  id: string;
  channel: Canal;
  destination: string;
  /** SMS: nombre y número enmascarado del destinatario. */
  destino_etiqueta?: string | null;
  status: EstadoEntrega;
  attempts: number;
  last_attempt_at: string | null;
  delivered_at: string | null;
  error: string | null;
}

export interface EventoResumen {
  id: string;
  occurred_at: string;
  magnitude: number | null;
  magnitude_type: string | null;
  depth_km: number | null;
  locality: string | null;
  latitude: number;
  longitude: number;
}

export interface Aviso {
  id: string;
  /** Siempre "aviso_interno": aviso operativo de la empresa, nunca una alerta oficial. */
  categoria: string;
  rule_id: string;
  rule_name: string | null;
  event_id: string;
  evento: EventoResumen | null;
  severity: Severidad;
  title: string;
  message: string;
  source_url: string | null;
  distance_km: number | null;
  status: EstadoAviso;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  entregas: Entrega[];
}

export interface PaginaAvisos {
  items: Aviso[];
  total: number;
  page: number;
  page_size: number;
}

export interface FiltrosAvisos {
  estado: EstadoAviso | "";
  severidad: Severidad | "";
  regla: string;
}
