export type Role = "admin" | "analyst" | "alert_operator" | "auditor" | "viewer";

export type UserStatus = "pending" | "active" | "suspended";

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
  lastLoginAt?: string;
  /**
   * Permisos que concede el backend para esta sesión. Si están presentes son
   * la fuente de verdad para el gating de la interfaz; si no, se usa
   * `ROLE_PERMISSIONS[role]` como respaldo.
   */
  permissions?: string[];
}

export interface RegisterData {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
  remember?: boolean;
  mfaCode?: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  analyst: "Analista",
  alert_operator: "Operador de alertas",
  auditor: "Auditor",
  viewer: "Solo lectura",
};

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: ["dashboard", "eventos", "eventos_exportar", "mapa", "analisis", "preparacion", "modelos", "estimaciones", "reglas", "alertas", "fuentes", "fuentes_sincronizar", "fuentes_configurar", "reportes", "reportes_generar", "reportes_pdf", "usuarios", "auditoria", "configuracion"],
  analyst: ["dashboard", "eventos", "eventos_exportar", "mapa", "analisis", "preparacion", "modelos", "estimaciones", "fuentes", "reportes", "reportes_generar", "reportes_pdf"],
  alert_operator: ["dashboard", "eventos", "eventos_exportar", "mapa", "reglas", "alertas", "reportes", "reportes_generar"],
  auditor: ["dashboard", "eventos", "eventos_exportar", "mapa", "analisis", "fuentes", "usuarios", "auditoria", "reportes", "reportes_generar"],
  viewer: ["dashboard", "eventos", "mapa", "reportes"],
};
