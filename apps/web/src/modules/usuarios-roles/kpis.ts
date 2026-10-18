import type { Role } from "@/types/auth";
import type { ResumenUsuarios } from "./types";

/* ════════════════════════════════════════════════════════════════
   Indicadores (KPI) del módulo "Usuarios y roles".

   Cada indicador es clicable: abre un modal con la lista de cuentas que
   representa (totales, pendientes, activos, con MFA). La barra de un rol del
   gráfico abre la lista de usuarios de ese rol.
   ════════════════════════════════════════════════════════════════ */

export type IdKpiUsuario = "totales" | "pendientes" | "activos" | "mfa";

export interface KpiUsuarioDef {
  id: IdKpiUsuario;
  etiqueta: string;
  descripcion: string;
  valor: (r: ResumenUsuarios) => string;
}

export const KPIS: KpiUsuarioDef[] = [
  {
    id: "totales",
    etiqueta: "Usuarios totales",
    descripcion: "Total de cuentas registradas (activas, pendientes y suspendidas).",
    valor: (r) => r.total.toLocaleString("es-PE"),
  },
  {
    id: "pendientes",
    etiqueta: "Pendientes de aprobación",
    descripcion: "Cuentas registradas que esperan aprobación y asignación de rol.",
    valor: (r) => r.pendientes.toLocaleString("es-PE"),
  },
  {
    id: "activos",
    etiqueta: "Activos",
    descripcion: "Cuentas habilitadas que pueden iniciar sesión.",
    valor: (r) => r.activos.toLocaleString("es-PE"),
  },
  {
    id: "mfa",
    etiqueta: "Con MFA",
    descripcion: "Cuentas con verificación en dos pasos (TOTP) activada.",
    valor: (r) => r.conMfa.toLocaleString("es-PE"),
  },
];

/** Sección ampliable del módulo. */
export type SeccionUsuarios =
  | IdKpiUsuario
  | `rol-${Role}`
  | "matriz"
  | "pendientes-cola";
