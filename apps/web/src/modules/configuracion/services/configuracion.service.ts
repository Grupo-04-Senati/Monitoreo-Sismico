import { apiGet, apiPost, apiPut } from "@/lib/api";
import type { Cambio, Configuracion, EstadoSistema, Parametro, Retencion } from "../types";

/* ════════════════════════════════════════════════════════════════
   Acceso a datos del módulo "Configuración" (solo Administrador):

     GET  /api/v1/settings                       → parámetros + entorno (sin secretos)
     PUT  /api/v1/settings/{clave}               → cambiar un parámetro (auditado)
     GET  /api/v1/settings/history               → control de cambios
     GET  /api/v1/settings/audit-retention       → vista previa de la retención
     POST /api/v1/settings/audit-retention/purge → purga manual (auditada)
     GET  /api/v1/monitoring                     → estado operativo del sistema
   ════════════════════════════════════════════════════════════════ */

export const obtenerConfiguracion = () => apiGet<Configuracion>("/settings");

export const cambiarParametro = (clave: string, valor: number) =>
  apiPut<Parametro>(`/settings/${encodeURIComponent(clave)}`, { valor });

export const obtenerHistorial = () => apiGet<Cambio[]>("/settings/history?limite=30");

export const obtenerRetencion = () => apiGet<Retencion>("/settings/audit-retention");

export const purgarAuditoria = () => apiPost<Retencion>("/settings/audit-retention/purge");

export const obtenerEstado = () => apiGet<EstadoSistema>("/monitoring");
