import type { FiltrosAuditoria } from "../types";

/* Etiquetas legibles de la bitácora. Lo que no esté aquí se muestra con su clave
   técnica (nunca se oculta un registro por no tener etiqueta). */

export const ETIQUETA_ACCION: Record<string, string> = {
  login: "Inicio de sesión",
  login_fallido: "Inicio de sesión fallido",
  login_fallido_mfa: "Segundo factor fallido",
  logout: "Cierre de sesión",
  usuario_registrado: "Usuario registrado",
  usuario_alta: "Usuario dado de alta",
  usuario_aprobado: "Usuario aprobado",
  usuario_actualizado: "Usuario actualizado",
  usuario_suspendido: "Usuario suspendido",
  usuario_reactivado: "Usuario reactivado",
  bloqueo_ultimo_admin: "Bloqueo: último administrador",
  admin_creado_por_cli: "Administrador creado (consola)",
  admin_restablecido_por_cli: "Administrador restablecido (consola)",
  fuente_sincronizar: "Sincronización de fuente",
  sismo_simulado: "Sismo simulado (demo)",
  fuente_configurada: "Fuente configurada",
  dataset_creado: "Dataset creado",
  dataset_aprobado: "Dataset aprobado",
  ml_experimento_creado: "Experimento de ML",
  ml_modelo_aprobado: "Modelo aprobado",
  estimacion_creada: "Estimación generada",
  estimacion_publicada: "Estimación publicada",
  estimacion_retirada: "Estimación retirada",
  regla_creada: "Regla creada",
  regla_editada: "Regla editada",
  regla_activada: "Regla activada",
  regla_desactivada: "Regla desactivada",
  alerta_generada: "Aviso generado",
  alerta_aprobada: "Aviso aprobado",
  alerta_cancelada: "Aviso cancelado",
  alerta_acusada: "Acuse de aviso",
  alerta_reintentada: "Entrega reintentada",
  reporte_solicitado: "Reporte solicitado",
  reporte_generado: "Reporte generado",
  reporte_fallido: "Reporte fallido",
  reporte_descargado: "Reporte descargado",
  parametro_cambiado: "Parámetro cambiado",
  auditoria_exportada: "Auditoría exportada",
  auditoria_purgada: "Auditoría purgada",
};

export const ETIQUETA_ENTIDAD: Record<string, string> = {
  auth: "Sesión",
  user: "Usuario",
  data_source: "Fuente de datos",
  dataset: "Dataset",
  ml_experiment: "Experimento de ML",
  model_registry: "Modelo",
  risk_estimate: "Estimación",
  alert_rule: "Regla de aviso",
  alert: "Aviso",
  report_job: "Reporte",
  system_setting: "Parámetro",
  audit_log: "Auditoría",
};

export const etiquetaAccion = (a: string) => ETIQUETA_ACCION[a] ?? a;
export const etiquetaEntidad = (e: string) => ETIQUETA_ENTIDAD[e] ?? e;

/** Acciones que conviene distinguir de un vistazo (seguridad o borrado). */
export const ACCIONES_SENSIBLES = new Set([
  "login_fallido", "login_fallido_mfa", "bloqueo_ultimo_admin", "usuario_suspendido",
  "auditoria_purgada", "auditoria_exportada", "parametro_cambiado",
]);

export const FILTROS_VACIOS: FiltrosAuditoria = { actor_id: "", action: "", entity_type: "", entity_id: "", desde: "", hasta: "" };

/** Día en UTC-5 → instante ISO del inicio (o del fin) de ese día. */
export function limiteDia(dia: string, fin: boolean): string {
  return `${dia}T${fin ? "23:59:59.999" : "00:00:00"}-05:00`;
}

export interface FilaDiferencia {
  campo: string;
  antes: string;
  despues: string;
  cambio: boolean;
}

function texto(v: unknown): string {
  if (v === undefined) return "—";
  if (v === null) return "null";
  return typeof v === "string" ? v : JSON.stringify(v);
}

/** Une los campos de antes y después en filas comparables. */
export function diferencias(antes: Record<string, unknown> | null, despues: Record<string, unknown> | null): FilaDiferencia[] {
  const campos = Array.from(new Set([...Object.keys(antes ?? {}), ...Object.keys(despues ?? {})])).sort();
  return campos.map((campo) => {
    const a = antes ? antes[campo] : undefined;
    const d = despues ? despues[campo] : undefined;
    return { campo, antes: texto(a), despues: texto(d), cambio: JSON.stringify(a) !== JSON.stringify(d) };
  });
}
