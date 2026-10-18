import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/app/auth/AuthContext";
import type { Role } from "@/types/auth";

interface RouteGuardProps {
  permission: string;
}

/** Pantalla mínima mientras se recupera la sesión desde la API. */
function SessionLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <svg
        className="animate-spin h-6 w-6 text-accent-500"
        viewBox="0 0 24 24"
        fill="none"
        role="status"
        aria-label="Cargando"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
        <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
      </svg>
    </div>
  );
}

export function RouteGuard({ permission }: RouteGuardProps) {
  const { isAuthenticated, canAccess, loading } = useAuth();
  const location = useLocation();

  if (loading) return <SessionLoading />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!canAccess(permission)) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}

interface RoleGuardProps {
  roles: Role[];
}

export function RoleGuard({ roles }: RoleGuardProps) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <SessionLoading />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
