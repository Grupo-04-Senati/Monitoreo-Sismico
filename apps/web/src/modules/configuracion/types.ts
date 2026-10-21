/* Tipos del módulo "Configuración" (PDF §6.13). Reflejan la API `/api/v1/settings`
   (ver `services/api/app/schemas/configuracion.py`). */

export interface Parametro {
  clave: string;
  etiqueta: string;
  descripcion: string;
  grupo: string;
  unidad: string;
  minimo: number;
  maximo: number;
  defecto: number;
  /** Dónde y cuándo se aplica el cambio. */
  efecto: string;
  valor: number;
  personalizado: boolean;
  actualizado_en: string | null;
  actualizado_por: string | null;
}

export interface Entorno {
  entorno: string;
  fuentes_activas: string[];
  origenes_cors: string[];
  cookies_seguras: boolean;
  sesion_minutos: number;
  correo: { activado: boolean; configurado: boolean; servidor: string | null; remitente: string | null };
  acceso: { intentos_antes_de_bloqueo: number; bloqueo_minutos: number; intentos_por_ip_por_minuto: number };
  advertencias: string[];
}

export interface Configuracion {
  parametros: Parametro[];
  entorno: Entorno;
}

export interface Cambio {
  id: string;
  accion: "parametro_cambiado" | "auditoria_purgada" | string;
  clave: string | null;
  etiqueta: string | null;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  fecha: string;
  actor: string | null;
}

export interface Retencion {
  retencion_dias: number;
  minimo_dias: number;
  corte: string;
  total: number;
  a_purgar: number;
  mas_antiguo: string | null;
  borrados?: number | null;
}
