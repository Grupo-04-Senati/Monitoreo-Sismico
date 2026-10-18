import type { Role } from "@/types/auth";
import { ROLE_LABELS, ROLE_PERMISSIONS } from "@/types/auth";
import type {
  AccesoPermiso,
  ChipFiltro,
  EstadoUsuario,
  FilaMatrizPermisos,
  FiltrosUsuarios,
  OpcionFiltro,
  TabUsuario,
} from "../types";

/* ════════════════════════════════════════════════════════════════
   Contrato del módulo "Usuarios y roles": valores por defecto, opciones de
   los selectores, etiquetas/colores, traducción entre el estado y la URL, y
   la matriz de permisos módulo × rol (sección 7 del prompt maestro).
   ════════════════════════════════════════════════════════════════ */

export const TAMANO_POR_DEFECTO = 10;
export const TAMANOS_PAGINA = [5, 10, 25] as const;
export const ORDEN_POR_DEFECTO = "recientes";
export const ULTIMO_ACCESO_POR_DEFECTO = "";

export const ESTADOS: OpcionFiltro[] = [
  { value: "", label: "Todos los estados" },
  { value: "activo", label: "Activo" },
  { value: "pendiente", label: "Pendiente de aprobación" },
  { value: "suspendido", label: "Suspendido" },
];

/** Catálogo de roles con etiqueta y descripción (informativo). */
export const ROLES_INFO: { rol: Role; nombre: string; descripcion: string }[] = [
  { rol: "admin", nombre: ROLE_LABELS.admin, descripcion: "Control total: usuarios, roles y configuración." },
  { rol: "analyst", nombre: ROLE_LABELS.analyst, descripcion: "Análisis de datos, modelos y reportes." },
  { rol: "alert_operator", nombre: ROLE_LABELS.alert_operator, descripcion: "Reglas de alerta y centro de alertas." },
  { rol: "auditor", nombre: ROLE_LABELS.auditor, descripcion: "Consulta y auditoría sin operación." },
  { rol: "viewer", nombre: ROLE_LABELS.viewer, descripcion: "Acceso de consulta al monitoreo." },
];

export const ROLES_OPCIONES: OpcionFiltro[] = [
  { value: "", label: "Todos los roles" },
  { value: "admin", label: ROLE_LABELS.admin },
  { value: "analyst", label: ROLE_LABELS.analyst },
  { value: "alert_operator", label: ROLE_LABELS.alert_operator },
  { value: "auditor", label: ROLE_LABELS.auditor },
  { value: "viewer", label: ROLE_LABELS.viewer },
];

export const ULTIMO_ACCESO: OpcionFiltro[] = [
  { value: "", label: "Cualquier fecha" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "nunca", label: "Nunca ha accedido" },
];

export const ORDENES: OpcionFiltro[] = [
  { value: "recientes", label: "Altas más recientes" },
  { value: "antiguos", label: "Altas más antiguas" },
];

export const TABS: { value: TabUsuario; label: string }[] = [
  { value: "datos", label: "Datos" },
  { value: "roles", label: "Roles y permisos" },
  { value: "actividad", label: "Actividad reciente" },
];

/* ════ Etiquetas y colores ════ */

export const ETIQUETA_ESTADO: Record<EstadoUsuario, string> = {
  activo: "Activo",
  pendiente: "Pendiente de aprobación",
  suspendido: "Suspendido",
};

export const COLOR_ESTADO: Record<EstadoUsuario, string> = {
  activo: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  pendiente: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  suspendido: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};

/** Símbolo textual del estado (sin semáforo). */
export const SIMBOLO_ESTADO: Record<EstadoUsuario, string> = {
  activo: "✓",
  pendiente: "⚠",
  suspendido: "✕",
};

export const ETIQUETA_ACCESO: Record<AccesoPermiso, string> = {
  ver: "Puede ver",
  operar: "Puede operar",
  sin_acceso: "Sin acceso",
};

export const SIMBOLO_ACCESO: Record<AccesoPermiso, string> = {
  ver: "◐",
  operar: "●",
  sin_acceso: "—",
};

/* ════ Matriz de permisos módulo × rol ════ */

const MODULOS: { modulo: string; etiqueta: string }[] = [
  { modulo: "dashboard", etiqueta: "Dashboard" },
  { modulo: "eventos", etiqueta: "Eventos sísmicos" },
  { modulo: "mapa", etiqueta: "Mapa sísmico" },
  { modulo: "analisis", etiqueta: "Análisis estadístico" },
  { modulo: "preparacion", etiqueta: "Preparación de datos" },
  { modulo: "modelos", etiqueta: "Modelos ML" },
  { modulo: "estimaciones", etiqueta: "Estimaciones" },
  { modulo: "reglas", etiqueta: "Reglas de alertas" },
  { modulo: "alertas", etiqueta: "Centro de alertas" },
  { modulo: "fuentes", etiqueta: "Fuentes de datos" },
  { modulo: "reportes", etiqueta: "Reportes" },
  { modulo: "usuarios", etiqueta: "Usuarios y roles" },
  { modulo: "auditoria", etiqueta: "Auditoría" },
  { modulo: "configuracion", etiqueta: "Configuración" },
];

/** Roles que, además de ver el módulo, pueden operarlo. */
const PUEDE_OPERAR: Record<string, Role[]> = {
  eventos: ["admin", "analyst", "alert_operator"],
  reglas: ["admin", "alert_operator"],
  alertas: ["admin", "alert_operator"],
  preparacion: ["admin", "analyst"],
  modelos: ["admin", "analyst"],
  estimaciones: ["admin", "analyst"],
  fuentes: ["admin"],
  reportes: ["admin", "analyst", "alert_operator"],
  usuarios: ["admin"],
  configuracion: ["admin"],
};

const ROLES_ORDEN: Role[] = ["admin", "analyst", "alert_operator", "auditor", "viewer"];

export const ROLES_MATRIZ = ROLES_ORDEN;

function accesoDe(modulo: string, rol: Role): AccesoPermiso {
  const puedeVer = ROLE_PERMISSIONS[rol]?.includes(modulo) ?? false;
  if (!puedeVer) return "sin_acceso";
  return PUEDE_OPERAR[modulo]?.includes(rol) ? "operar" : "ver";
}

export const MATRIZ_PERMISOS: FilaMatrizPermisos[] = MODULOS.map((m) => ({
  modulo: m.modulo,
  etiqueta: m.etiqueta,
  porRol: ROLES_ORDEN.reduce(
    (acc, rol) => ({ ...acc, [rol]: accesoDe(m.modulo, rol) }),
    {} as Record<Role, AccesoPermiso>,
  ),
}));

/* ════ URL ⇄ estado ════ */

function esEstado(v: string | null): v is EstadoUsuario {
  return v === "activo" || v === "pendiente" || v === "suspendido";
}

function esRol(v: string | null): v is Role {
  return v === "admin" || v === "analyst" || v === "alert_operator" || v === "auditor" || v === "viewer";
}

function esUltimoAcceso(v: string | null): v is FiltrosUsuarios["ultimoAcceso"] {
  return v === "7d" || v === "30d" || v === "nunca";
}

function esOrden(v: string | null): v is FiltrosUsuarios["orden"] {
  return v === "recientes" || v === "antiguos";
}

export function filtrosUsuariosDesdeParams(params: URLSearchParams): FiltrosUsuarios {
  const estado = params.get("estado");
  const rol = params.get("rol");
  const acceso = params.get("acceso");
  const orden = params.get("orden");
  return {
    estado: esEstado(estado) ? estado : "",
    rol: esRol(rol) ? rol : "",
    q: params.get("q") ?? "",
    ultimoAcceso: esUltimoAcceso(acceso) ? acceso : ULTIMO_ACCESO_POR_DEFECTO,
    orden: esOrden(orden) ? orden : ORDEN_POR_DEFECTO,
  };
}

export function paginaDesdeParams(params: URLSearchParams): number {
  const n = Number(params.get("pag"));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function tamanoDesdeParams(params: URLSearchParams): number {
  const n = Number(params.get("tam"));
  return (TAMANOS_PAGINA as readonly number[]).includes(n) ? n : TAMANO_POR_DEFECTO;
}

export function chipsUsuarios(f: FiltrosUsuarios): ChipFiltro[] {
  const chips: ChipFiltro[] = [];
  if (f.estado) chips.push({ clave: "estado", etiqueta: `Estado: ${ETIQUETA_ESTADO[f.estado]}` });
  if (f.rol) chips.push({ clave: "rol", etiqueta: `Rol: ${ROLE_LABELS[f.rol]}` });
  if (f.q) chips.push({ clave: "q", etiqueta: `Buscar: “${f.q}”` });
  if (f.ultimoAcceso) {
    chips.push({ clave: "acceso", etiqueta: `Último acceso: ${ULTIMO_ACCESO.find((u) => u.value === f.ultimoAcceso)?.label ?? f.ultimoAcceso}` });
  }
  if (f.orden !== ORDEN_POR_DEFECTO) chips.push({ clave: "orden", etiqueta: `Orden: ${ORDENES.find((o) => o.value === f.orden)?.label ?? f.orden}` });
  return chips;
}
