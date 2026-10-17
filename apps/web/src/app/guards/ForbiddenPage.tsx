import { Link } from "react-router-dom";
import { useAuth } from "@/app/auth/AuthContext";
import { ROLE_LABELS } from "@/types/auth";
import { IconShield } from "@/components/ui/Icons";

export default function ForbiddenPage() {
  const { user } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-5">
        <IconShield size={28} className="text-red-500" />
      </div>
      <p className="text-5xl font-bold text-primary-300 mb-3">403</p>
      <h1 className="text-2xl font-bold text-content mb-2">Acceso denegado</h1>
      <p className="text-content-secondary mb-6 max-w-md leading-relaxed">
        No tiene permisos para acceder a este módulo.
        {user && (
          <>
            {" "}Su rol actual es <strong>{ROLE_LABELS[user.role]}</strong>.
          </>
        )}
      </p>
      <Link
        to="/"
        className="px-5 py-2.5 bg-accent-500 text-white font-medium rounded-lg hover:bg-accent-600 transition-colors"
      >
        Volver al Dashboard
      </Link>
    </div>
  );
}
