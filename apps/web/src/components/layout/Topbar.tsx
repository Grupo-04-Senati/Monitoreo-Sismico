import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@/app/auth/AuthContext";
import { ROLE_LABELS } from "@/types/auth";
import type { EstadoConector } from "@/types";
import { cargarBarraFuente, type BarraFuente } from "@/modules/fuentes-datos/services/fuentes.service";
import { ETIQUETA_CONECTOR } from "@/modules/fuentes-datos/schemas/fuentes.schema";
import { fmtTimeUTC5 } from "@/lib/format";
import { IconSunMoon, IconLogOut, IconServer } from "@/components/ui/Icons";

const COLOR_CONECTOR: Record<EstadoConector, string> = {
  operativo: "bg-success",
  degradado: "bg-warning",
  sin_conexion: "bg-danger",
};

export default function Topbar() {
  const { user, logout } = useAuth();
  const [fuente, setFuente] = useState<BarraFuente | null>(null);

  useEffect(() => {
    let vivo = true;
    cargarBarraFuente()
      .then((f) => {
        if (vivo) setFuente(f);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  const toggleTheme = () => {
    const el = document.documentElement;
    const next = el.getAttribute("data-theme") === "dark" ? "light" : "dark";
    el.setAttribute("data-theme", next);
  };

  const initials = user
    ? user.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <header className="app-topbar h-[56px] border-b border-border flex items-center justify-between px-5 shrink-0 z-20">
      {/* Izquierda: fuente única */}
      <div className="flex items-center gap-5">
        <div
          className="flex items-center gap-2"
          title={fuente ? `${fuente.organizacion} — ${fuente.nombre}` : "Cargando fuente…"}
        >
          {fuente ? (
            <span className={`w-2 h-2 rounded-full ${COLOR_CONECTOR[fuente.estadoConector]}`} aria-hidden="true" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-border" aria-hidden="true" />
          )}
          <span className="text-xs text-content-secondary font-medium">
            Fuente: {fuente ? fuente.organizacion : "—"}
            {fuente && (
              <span className="hidden sm:inline text-content-muted"> ({ETIQUETA_CONECTOR[fuente.estadoConector]})</span>
            )}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-content-muted">
          <IconServer size={13} />
          <span>{fuente ? `Último éxito ${fmtTimeUTC5(fuente.ultimoExitoUtc)}` : "Sinc: —"}</span>
        </div>
      </div>

      {/* Derecha: tema + usuario */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md text-content-muted hover:text-content hover:bg-surface-tertiary transition-colors"
          aria-label="Cambiar tema claro/oscuro"
        >
          <IconSunMoon size={17} />
        </button>

        {user && (
          <div className="flex items-center gap-3">
            <Link to="/perfil" title="Mi perfil" className="flex items-center gap-2.5 rounded-md px-1 py-0.5 transition-colors hover:bg-surface-tertiary">
              <div className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                {initials}
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-content leading-tight">{user.fullName}</p>
                <p className="text-[11px] text-content-muted">{ROLE_LABELS[user.role]} · Mi perfil</p>
              </div>
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-md hover:bg-surface-tertiary transition-colors text-content-secondary"
            >
              <IconLogOut size={13} />
              Salir
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
