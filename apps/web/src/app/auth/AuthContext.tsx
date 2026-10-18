import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { User, LoginData, RegisterData } from "@/types/auth";
import { ROLE_PERMISSIONS } from "@/types/auth";
import { ApiError } from "@/lib/api";
import { loginApi, registerApi, logoutApi, meApi } from "@/app/auth/auth.api";

interface AuthResult {
  success: boolean;
  error?: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  /** true mientras se intenta recuperar la sesión de la API al arrancar. */
  loading: boolean;
  login: (data: LoginData) => Promise<AuthResult>;
  register: (data: RegisterData) => Promise<AuthResult>;
  logout: () => Promise<void>;
  canAccess: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Traduce el fallo de la API a un mensaje comprensible para el usuario. */
function mensajeDeError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.detail || fallback;
  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /* Recupera la sesión desde la cookie HttpOnly al arrancar. */
  useEffect(() => {
    let activo = true;
    meApi()
      .then((u) => {
        if (activo) setUser(u);
      })
      .catch(() => {
        /* sin sesión válida: se permanece desautenticado */
      })
      .finally(() => {
        if (activo) setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  const login = useCallback(async (data: LoginData): Promise<AuthResult> => {
    try {
      setUser(await loginApi(data));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: mensajeDeError(
          error,
          "No se pudo iniciar sesión. Verifique su correo y contraseña.",
        ),
      };
    }
  }, []);

  const register = useCallback(async (data: RegisterData): Promise<AuthResult> => {
    try {
      await registerApi(data);
      return { success: true };
    } catch (error) {
      return { success: false, error: mensajeDeError(error, "No se pudo completar el registro.") };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      /* aunque falle el backend, se limpia la sesión local */
    }
    setUser(null);
  }, []);

  const canAccess = useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.permissions) return user.permissions.includes(permission);
      return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
        canAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
