import { useAuth } from "@/app/auth/AuthContext";
import { ROLE_LABELS } from "@/types/auth";
import { mockSources } from "@/lib/mock/data";
import { IconSunMoon, IconLogOut, IconServer } from "@/components/ui/Icons";

export default function Topbar() {
  const { user, logout } = useAuth();
  const src = mockSources[0];

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
        <div className="flex items-center gap-2" title={`${src.organization} — ${src.name} · latencia ${src.latencyMs} ms`}>
          <span
            className={`w-2 h-2 rounded-full ${src.status === "online" ? "bg-success" : src.status === "degraded" ? "bg-warning" : "bg-danger"}`}
            aria-hidden="true"
          />
          <span className="text-xs text-content-secondary font-medium">
            Fuente: {src.organization}
            <span className="hidden sm:inline text-content-muted"> ({src.status === "online" ? "en línea" : src.status === "degraded" ? "degradada" : "fuera de línea"})</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-content-muted">
          <IconServer size={13} />
          <span>Sinc hace 5 min</span>
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
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">
                {initials}
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-content leading-tight">{user.fullName}</p>
                <p className="text-[11px] text-content-muted">{ROLE_LABELS[user.role]}</p>
              </div>
            </div>
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
