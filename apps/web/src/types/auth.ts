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
  admin: ["dashboard", "eventos", "eventos_exportar", "mapa", "analisis", "preparacion", "modelos", "estimaciones", "reglas", "alertas", "fuentes", "reportes", "usuarios", "auditoria", "configuracion"],
  analyst: ["dashboard", "eventos", "eventos_exportar", "mapa", "analisis", "preparacion", "modelos", "estimaciones", "reportes"],
  alert_operator: ["dashboard", "eventos", "eventos_exportar", "mapa", "reglas", "alertas"],
  auditor: ["dashboard", "eventos", "eventos_exportar", "mapa", "analisis", "auditoria", "reportes"],
  viewer: ["dashboard", "eventos", "mapa"],
};
