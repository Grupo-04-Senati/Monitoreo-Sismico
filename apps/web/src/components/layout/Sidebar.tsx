import { NavLink } from "react-router";
import { useAuth } from "@/app/auth/AuthContext";

import {
  IconDashboard, IconEvents, IconMap, IconAnalytics, IconDatabase,
  IconML, IconEstimate, IconAlertRule, IconAlertCenter, IconSource,
  IconReport, IconUsers, IconAudit, IconSettings,
} from "@/components/ui/Icons";

interface NavItem {
  to: string;
  label: string;
  permission: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Monitoreo",
    items: [
      { to: "/", label: "Dashboard", permission: "dashboard", icon: IconDashboard },
      { to: "/eventos", label: "Eventos sísmicos", permission: "eventos", icon: IconEvents },
      { to: "/mapa-sismico", label: "Mapa sísmico", permission: "mapa", icon: IconMap },
    ],
  },
  {
    title: "Analítica",
    items: [
      { to: "/analisis", label: "Análisis estadístico", permission: "analisis", icon: IconAnalytics },
      { to: "/preparacion-datos", label: "Preparación de datos", permission: "preparacion", icon: IconDatabase },
      { to: "/modelos-ml", label: "Modelos ML", permission: "modelos", icon: IconML },
      { to: "/estimaciones", label: "Estimaciones", permission: "estimaciones", icon: IconEstimate },
    ],
  },
  {
    title: "Alertas",
    items: [
      { to: "/reglas-alertas", label: "Reglas de alertas", permission: "reglas", icon: IconAlertRule },
      { to: "/alertas", label: "Centro de alertas", permission: "alertas", icon: IconAlertCenter },
    ],
  },
  {
    title: "Datos",
    items: [
      { to: "/fuentes-datos", label: "Fuentes de datos", permission: "fuentes", icon: IconSource },
      { to: "/reportes", label: "Reportes", permission: "reportes", icon: IconReport },
    ],
  },
  {
    title: "Administración",
    items: [
      { to: "/usuarios", label: "Usuarios y roles", permission: "usuarios", icon: IconUsers },
      { to: "/auditoria", label: "Auditoría", permission: "auditoria", icon: IconAudit },
      { to: "/configuracion", label: "Configuración", permission: "configuracion", icon: IconSettings },
    ],
  },
];

const SIDEBAR_EXPANDED = 240;
const SIDEBAR_COLLAPSED = 60;

interface SidebarProps {
  collapsed: boolean;
  hovered: boolean;
}

export default function Sidebar({ collapsed, hovered }: SidebarProps) {
  const { canAccess } = useAuth();
  const expanded = !collapsed || hovered;

  return (
    <aside
      className="app-sidebar h-screen flex flex-col shrink-0 sticky top-0 z-30 overflow-hidden"
      style={{
        width: expanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED,
        transition: "width 250ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      aria-label="Navegación principal"
    >
      {/* Logo */}
      <div className="app-sidebar-head flex items-center min-h-[64px] px-3">
        <div className="app-brand-mark w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <div
          className="ml-3 overflow-hidden whitespace-nowrap"
          style={{
            opacity: expanded ? 1 : 0,
            transform: expanded ? "translateX(0)" : "translateX(-8px)",
            transition: "opacity 200ms ease, transform 200ms ease",
          }}
        >
          <h1 className="app-brand-title text-[15px] font-bold leading-tight">Monitoreo Sísmico</h1>
          <p className="app-brand-sub text-[11px] tracking-wide">Plataforma empresarial</p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: "thin" }}>
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => canAccess(item.permission));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.title} className="mb-1">
              {/* Título de grupo (solo expandido) */}
              <div
                className="overflow-hidden whitespace-nowrap"
                style={{
                  opacity: expanded ? 1 : 0,
                  height: expanded ? "auto" : 0,
                  transition: "opacity 180ms ease, height 180ms ease",
                }}
              >
                <p className="app-nav-group px-4 pt-3.5 pb-1.5 text-[11px] font-semibold uppercase tracking-widest">
                  {group.title}
                </p>
              </div>

              {/* Separador cuando colapsado */}
              {!expanded && <div className="app-sidebar-sep mx-3 my-1.5" />}

              {visibleItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className="app-nav-item group flex items-center"
                    style={{
                      paddingLeft: expanded ? 16 : 18,
                      paddingRight: expanded ? 16 : 0,
                      gap: expanded ? 11 : 0,
                      justifyContent: expanded ? "flex-start" : "center",
                    }}
                    title={!expanded ? item.label : undefined}
                  >
                    <Icon size={20} className="shrink-0" />
                    <span
                      className="overflow-hidden whitespace-nowrap"
                      style={{
                        opacity: expanded ? 1 : 0,
                        width: expanded ? "auto" : 0,
                        transition: "opacity 180ms ease, width 200ms ease",
                      }}
                    >
                      {item.label}
                    </span>

                    {/* Tooltip en modo colapsado */}
                    {!expanded && (
                      <div className="app-tip absolute left-full ml-2 px-2.5 py-1 text-[12px] rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                        {item.label}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
