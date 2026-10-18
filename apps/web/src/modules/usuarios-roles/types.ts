import type {
  AccesoPermiso,
  ActividadUsuario,
  ConteoRol,
  EstadoUsuario,
  FilaMatrizPermisos,
  FiltrosUsuarios,
  PaginaUsuarios,
  ResumenUsuarios,
  UsuarioAdmin,
} from "@/types";

export type {
  AccesoPermiso,
  ActividadUsuario,
  ConteoRol,
  EstadoUsuario,
  FilaMatrizPermisos,
  FiltrosUsuarios,
  PaginaUsuarios,
  ResumenUsuarios,
  UsuarioAdmin,
};

/** Opción de un selector (estado, rol, último acceso…). */
export interface OpcionFiltro {
  value: string;
  label: string;
}

/** Filtro activo mostrado como chip removible. */
export interface ChipFiltro {
  clave: string;
  etiqueta: string;
}

/** Pestañas del modal de usuario. */
export type TabUsuario = "datos" | "roles" | "actividad";

/** Acción disponible sobre una cuenta (solo Administrador). */
export type AccionUsuario = "aprobar" | "cambiar-rol" | "suspender" | "reactivar";
