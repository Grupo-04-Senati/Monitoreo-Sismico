/* ════════════════════════════════════════════════════════════════
   Autenticación contra la API real.

   Envuelve `POST /auth/login`, `POST /auth/register`, `GET /auth/me` y
   `POST /auth/logout`, y adapta la forma del backend (`UserOut`) al tipo
   `User` que usa el frontend.
   ════════════════════════════════════════════════════════════════ */

import { apiGet, apiPost } from "@/lib/api";
import type { LoginData, RegisterData, Role, User, UserStatus } from "@/types/auth";

/** Respuesta de `UserOut` del backend. */
interface UserOutApi {
  id: string;
  full_name: string;
  email: string;
  roles: string[];
  status: string;
  mfa_enabled: boolean;
  last_login_at: string | null;
  created_at: string | null;
  permissions: string[];
}

interface TokenResponseApi {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserOutApi;
}

/** Backend (`UserOut`) → frontend (`User`). */
export function adaptarUsuario(u: UserOutApi): User {
  return {
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    role: (u.roles[0] as Role | undefined) ?? "viewer",
    status: u.status as UserStatus,
    createdAt: u.created_at ?? new Date().toISOString(),
    lastLoginAt: u.last_login_at ?? undefined,
    permissions: u.permissions,
  };
}

/** Inicia sesión y deja las cookies de sesión (HttpOnly) puestas. */
export async function loginApi(data: LoginData): Promise<User> {
  const res = await apiPost<TokenResponseApi>("/auth/login", {
    email: data.email,
    password: data.password,
    mfa_code: data.mfaCode || null,
    remember: data.remember ?? false,
  });
  return adaptarUsuario(res.user);
}

/** Registra una cuenta nueva (queda "pendiente" de aprobación). */
export async function registerApi(data: RegisterData): Promise<{ message: string }> {
  return apiPost<{ message: string; status: string }>("/auth/register", {
    full_name: data.fullName,
    email: data.email,
    password: data.password,
    accept_terms: true,
  });
}

/** Recupera la sesión actual a partir de las cookies (o lanza 401). */
export async function meApi(): Promise<User> {
  return adaptarUsuario(await apiGet<UserOutApi>("/auth/me"));
}

/** Cierra la sesión en el backend (borra las cookies). */
export async function logoutApi(): Promise<void> {
  await apiPost<void>("/auth/logout");
}
