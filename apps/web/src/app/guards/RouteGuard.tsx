import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/app/auth/AuthContext";
import type { Role } from "@/types/auth";

interface RouteGuardProps {
  permission: string;
}

export function RouteGuard({ permission }: RouteGuardProps) {
  const { isAuthenticated, canAccess } = useAuth();
  const location = useLocation();

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
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
