import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { fmtDateTimeUTC5 } from "@/lib/format";
import { downloadFile } from "@/lib/export";
import { buildXlsx } from "@/lib/xlsx";
import type { Role } from "@/types/auth";
import { ROLE_LABELS } from "@/types/auth";
import type {
  ActividadUsuario,
  ConteoRol,
  FilaMatrizPermisos,
  FiltrosUsuarios,
  PaginaUsuarios,
  ResumenUsuarios,
  UsuarioAdmin,
} from "../types";
import { ETIQUETA_ACCESO, MATRIZ_PERMISOS, ROLES_INFO, ROLES_MATRIZ } from "../schemas/usuarios.schema";

/* ════════════════════════════════════════════════════════════════
   Capa de acceso a datos del módulo "Usuarios y roles". SIEMPRE contra la API:
      GET    /api/v1/users?estado&rol&q&orden&ultimo_acceso&pagina&tamano
      GET    /api/v1/users/summary
      GET    /api/v1/users/{id} · GET /api/v1/users/{id}/activity
      GET    /api/v1/roles
      POST   /api/v1/users · PATCH /api/v1/users/{id}
      POST   /api/v1/users/{id}/approve · /suspend · /reactivate
   Toda acción de escritura llama a `registrar_auditoria()` en el backend con
   antes/después; el frontend solo confirma el cambio.
   ════════════════════════════════════════════════════════════════ */

/* ─────────────────────────── Adaptador API ─────────────────────────── */

interface UsuarioOutAPI {
  id: string;
  full_name: string;
  email: string;
  roles: string[];
  status: string;
  mfa_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
}

interface PaginaUsuariosAPI {
  items: UsuarioOutAPI[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

interface ActividadAPI {
  items: {
    id: string;
    hora_utc: string;
    accion: string;
    detalle: string;
    ip: string;
    resultado: "ok" | "fallido";
  }[];
}

interface ResumenAPI {
  total: number;
  pendientes: number;
  activos: number;
  con_mfa: number;
}

interface RolAPI {
  name: string;
  label: string;
  description: string | null;
  usuarios: number;
}

const ESTADO_API: Record<UsuarioAdmin["estado"], string> = {
  pendiente: "pending",
  activo: "active",
  suspendido: "suspended",
};

const ESTADO_FE: Record<string, UsuarioAdmin["estado"]> = {
  pending: "pendiente",
  active: "activo",
  suspended: "suspendido",
};

function adaptarUsuario(u: UsuarioOutAPI): UsuarioAdmin {
  return {
    id: u.id,
    nombre: u.full_name,
    correo: u.email,
    roles: u.roles as Role[],
    estado: ESTADO_FE[u.status] ?? "pendiente",
    mfa: u.mfa_enabled,
    ultimoAccesoUtc: u.last_login_at,
    creadoUtc: u.created_at,
    aprobadoPor: u.approved_by_name,
    aprobadoUtc: u.approved_at,
  };
}

/* ─────────────────────────── Lectura ─────────────────────────── */

export async function cargarResumen(): Promise<ResumenUsuarios> {
  const r = await apiGet<ResumenAPI>("/users/summary");
  return { total: r.total, pendientes: r.pendientes, activos: r.activos, conMfa: r.con_mfa };
}

export async function listarUsuarios(
  filtros: FiltrosUsuarios,
  pagina: number,
  tamano: number,
): Promise<PaginaUsuarios> {
  const qs = new URLSearchParams();
  if (filtros.estado) qs.set("estado", ESTADO_API[filtros.estado]);
  if (filtros.rol) qs.set("rol", filtros.rol);
  if (filtros.q.trim()) qs.set("q", filtros.q.trim());
  if (filtros.ultimoAcceso) qs.set("ultimo_acceso", filtros.ultimoAcceso);
  qs.set("orden", filtros.orden);
  qs.set("pagina", String(pagina));
  qs.set("tamano", String(tamano));
  const data = await apiGet<PaginaUsuariosAPI>(`/users?${qs.toString()}`);
  return {
    filas: data.items.map(adaptarUsuario),
    total: data.total,
    pagina: data.pagina,
    tamano: data.tamano,
    totalPaginas: data.total_paginas,
  };
}

/** Todas las filas que cumplen los filtros (para modales de KPI/rol y export). */
export async function listarTodos(filtros: FiltrosUsuarios, rol?: Role): Promise<UsuarioAdmin[]> {
  const f: FiltrosUsuarios = rol ? { ...filtros, rol } : filtros;
  const filas: UsuarioAdmin[] = [];
  let pagina = 1;
  for (;;) {
    const p = await listarUsuarios(f, pagina, 100);
    filas.push(...p.filas);
    if (pagina >= p.totalPaginas || p.filas.length === 0) return filas;
    pagina += 1;
  }
}

export async function obtenerUsuario(id: string): Promise<UsuarioAdmin | null> {
  try {
    return adaptarUsuario(await apiGet<UsuarioOutAPI>(`/users/${id}`));
  } catch {
    return null;
  }
}

export async function obtenerActividad(id: string): Promise<ActividadUsuario[]> {
  const data = await apiGet<ActividadAPI>(`/users/${id}/activity`);
  return data.items.map((a) => ({
    id: a.id,
    horaUtc: a.hora_utc,
    accion: a.accion,
    detalle: a.detalle,
    ip: a.ip,
    resultado: a.resultado,
  }));
}

export async function contarUsuariosPorRol(): Promise<ConteoRol[]> {
  const roles = await apiGet<RolAPI[]>("/roles");
  const porNombre = new Map(roles.map((r) => [r.name, r.usuarios]));
  return ROLES_INFO.map((r) => ({ rol: r.rol, nombre: r.nombre, total: porNombre.get(r.rol) ?? 0 }));
}

/** Usuarios de un rol concreto (al hacer clic en una barra del gráfico). */
export function usuariosDelRol(rol: Role): Promise<UsuarioAdmin[]> {
  return listarTodos(
    { estado: "", rol: "", q: "", ultimoAcceso: "", orden: "recientes" },
    rol,
  );
}

/** Matriz de permisos módulo × rol (solo lectura, informativa). */
export function matrizPermisos(): FilaMatrizPermisos[] {
  return MATRIZ_PERMISOS;
}

/** Roles con su etiqueta y descripción. */
export function catalogoRoles() {
  return ROLES_INFO;
}

/* ─────────────────────────── Acciones de Administrador ─────────────────────────── */

export interface ResultadoAccion {
  ok: boolean;
  mensaje: string;
}

async function ejecutarApi(
  peticion: () => Promise<UsuarioOutAPI>,
  accion: string,
  usuario: UsuarioAdmin,
): Promise<ResultadoAccion> {
  try {
    const actualizado = adaptarUsuario(await peticion());
    return { ok: true, mensaje: `${accion} · ${actualizado.nombre}` };
  } catch (error) {
    const detalle = (error as { detail?: string }).detail ?? "No se pudo completar la acción.";
    return { ok: false, mensaje: detalle };
  }
}

export function aprobarUsuario(usuario: UsuarioAdmin, roles: Role[]): Promise<ResultadoAccion> {
  return ejecutarApi(
    () => apiPost<UsuarioOutAPI>(`/users/${usuario.id}/approve`, { roles }),
    "Cuenta aprobada",
    usuario,
  );
}

export function cambiarRolUsuario(usuario: UsuarioAdmin, roles: Role[]): Promise<ResultadoAccion> {
  return ejecutarApi(
    () => apiPatch<UsuarioOutAPI>(`/users/${usuario.id}`, { roles }),
    "Rol actualizado",
    usuario,
  );
}

export function suspenderUsuario(usuario: UsuarioAdmin): Promise<ResultadoAccion> {
  return ejecutarApi(() => apiPost<UsuarioOutAPI>(`/users/${usuario.id}/suspend`), "Cuenta suspendida", usuario);
}

export function reactivarUsuario(usuario: UsuarioAdmin): Promise<ResultadoAccion> {
  return ejecutarApi(() => apiPost<UsuarioOutAPI>(`/users/${usuario.id}/reactivate`), "Cuenta reactivada", usuario);
}

/* ─────────────────────────── Procedencia ─────────────────────────── */

export interface ProcedenciaUsuarios {
  total: number;
  actualizado: string;
}

export async function cargarProcedencia(): Promise<ProcedenciaUsuarios> {
  const [resumen, meta] = await Promise.all([
    cargarResumen(),
    apiGet<{ generated_at: string }>("/meta").catch(() => null),
  ]);
  return {
    total: resumen.total,
    actualizado: fmtDateTimeUTC5((meta?.generated_at ?? new Date().toISOString())),
  };
}

/* ─────────────────────────── Exportación por partes (CSV / XLSX) ─────────────────────────── */

export type ParteExportId = "resumen" | "usuarios" | "porRol" | "matriz" | "actividad";

export interface ParteExport {
  id: ParteExportId;
  label: string;
  hoja: string;
}

export const PARTES_EXPORT: ParteExport[] = [
  { id: "resumen", label: "Resumen (indicadores)", hoja: "Resumen" },
  { id: "usuarios", label: "Usuarios", hoja: "Usuarios" },
  { id: "porRol", label: "Usuarios por rol", hoja: "Por rol" },
  { id: "matriz", label: "Matriz de permisos", hoja: "Matriz" },
  { id: "actividad", label: "Actividad reciente", hoja: "Actividad" },
];

/** Contexto de exportación; el llamador lo completa con `cargarContextoExport`. */
export interface ContextoExport {
  filtros: FiltrosUsuarios;
  filas: UsuarioAdmin[];
  actividad: Record<string, ActividadUsuario[]>;
  resumen: ResumenUsuarios;
  conteos: ConteoRol[];
}

/** Reúne los datos necesarios para exportar (desde la API). */
export async function cargarContextoExport(filtros: FiltrosUsuarios): Promise<ContextoExport> {
  const [filas, resumen, conteos] = await Promise.all([
    listarTodos(filtros),
    cargarResumen(),
    contarUsuariosPorRol(),
  ]);
  const actividad: Record<string, ActividadUsuario[]> = {};
  await Promise.all(
    filas.map(async (u) => {
      actividad[u.id] = await obtenerActividad(u.id);
    }),
  );
  return { filtros, filas, actividad, resumen, conteos };
}

export interface Bloque {
  cols: string[];
  rows: (string | number | null)[][];
}

function celda(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function construirBloque(id: ParteExportId, ctx: ContextoExport): Bloque {
  switch (id) {
    case "resumen": {
      const r = ctx.resumen;
      return {
        cols: ["Indicador", "Valor"],
        rows: [
          ["Usuarios totales", r.total],
          ["Pendientes de aprobación", r.pendientes],
          ["Activos", r.activos],
          ["Con MFA", r.conMfa],
        ],
      };
    }
    case "usuarios":
      return {
        cols: ["nombre", "correo", "roles", "estado", "mfa", "ultimo_acceso_utc5", "fecha_alta_utc5"],
        rows: ctx.filas.map((u) => [
          u.nombre,
          u.correo,
          u.roles.map((r) => ROLE_LABELS[r]).join(", ") || "sin rol",
          u.estado,
          u.mfa ? "Sí" : "No",
          u.ultimoAccesoUtc ? fmtDateTimeUTC5(u.ultimoAccesoUtc) : "nunca",
          fmtDateTimeUTC5(u.creadoUtc),
        ]),
      };
    case "porRol":
      return {
        cols: ["rol", "usuarios"],
        rows: ctx.conteos.map((c) => [c.nombre, c.total]),
      };
    case "matriz": {
      const roles = ROLES_MATRIZ;
      return {
        cols: ["modulo", ...roles.map((r) => ROLE_LABELS[r])],
        rows: MATRIZ_PERMISOS.map((f) => [f.etiqueta, ...roles.map((r) => ETIQUETA_ACCESO[f.porRol[r]])]),
      };
    }
    case "actividad": {
      const rows: (string | number | null)[][] = [];
      for (const u of ctx.filas) {
        for (const a of ctx.actividad[u.id] ?? []) {
          rows.push([u.nombre, u.correo, fmtDateTimeUTC5(a.horaUtc), a.accion, a.detalle, a.ip, a.resultado]);
        }
      }
      return { cols: ["usuario", "correo", "hora_utc5", "accion", "detalle", "ip", "resultado"], rows };
    }
  }
}

export type FormatoExport = "csv" | "xlsx";

const fecha = () => new Date().toISOString().slice(0, 10);

export function textoPartes(ids: ParteExportId[], ctx: ContextoExport): string {
  const partes = PARTES_EXPORT.filter((p) => ids.includes(p.id));
  const lineas: string[] = [];
  partes.forEach((p, i) => {
    if (i) lineas.push("");
    lineas.push(`# ${p.label}`);
    const b = construirBloque(p.id, ctx);
    lineas.push(b.cols.map(celda).join(";"));
    for (const fila of b.rows) lineas.push(fila.map(celda).join(";"));
  });
  return lineas.join("\r\n");
}

export function exportarPartes(ids: ParteExportId[], formato: FormatoExport, ctx: ContextoExport): void {
  const partes = PARTES_EXPORT.filter((p) => ids.includes(p.id));
  if (!partes.length) return;

  if (formato === "xlsx") {
    const hojas = partes.map((p) => {
      const b = construirBloque(p.id, ctx);
      return { name: p.hoja, cols: b.cols, rows: b.rows };
    });
    downloadFile(`usuarios_roles_${fecha()}.xlsx`, buildXlsx(hojas));
    return;
  }

  downloadFile(`usuarios_roles_${fecha()}.csv`, "\uFEFF" + textoPartes(ids, ctx), "text/csv;charset=utf-8");
}
