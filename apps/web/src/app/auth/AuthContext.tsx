import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { User, LoginData, RegisterData } from "@/types/auth";
import { ROLE_PERMISSIONS } from "@/types/auth";
import { mockUsers } from "@/lib/mock/data";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (data: LoginData) => { success: boolean; error?: string };
  register: (data: RegisterData) => { success: boolean; error?: string };
  logout: () => void;
  canAccess: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "sismo_auth_user";
const REGISTERED_KEY = "sismo_registered_users";

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function loadRegisteredUsers(): (User & { password: string })[] {
  try {
    const raw = sessionStorage.getItem(REGISTERED_KEY);
    return raw ? (JSON.parse(raw) as (User & { password: string })[]) : [];
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadStoredUser());

  const login = useCallback((data: LoginData) => {
    const registered = loadRegisteredUsers();
    const allUsers = [...mockUsers, ...registered];
    const found = allUsers.find(
      (u) => u.email.toLowerCase() === data.email.toLowerCase() && u.password === data.password
    );

    if (!found || found.status !== "active") {
      return { success: false, error: "Credenciales incorrectas. Verifique su correo y contraseña." };
    }

    const { password: _, ...safeUser } = found;
    const sessionUser: User = { ...safeUser, lastLoginAt: new Date().toISOString() };

    if (data.remember) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
    }
    setUser(sessionUser);
    return { success: true };
  }, []);

  const register = useCallback((data: RegisterData) => {
    const registered = loadRegisteredUsers();
    const exists = [...mockUsers, ...registered].some(
      (u) => u.email.toLowerCase() === data.email.toLowerCase()
    );
    if (exists) {
      return { success: false, error: "Ya existe una cuenta con este correo." };
    }

    const newUser: User & { password: string } = {
      id: `u-${Date.now()}`,
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      role: "viewer",
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    registered.push(newUser);
    sessionStorage.setItem(REGISTERED_KEY, JSON.stringify(registered));
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const canAccess = useCallback(
    (permission: string) => {
      if (!user) return false;
      return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, register, logout, canAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
