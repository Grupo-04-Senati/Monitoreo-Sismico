import { useEffect, useRef, useState, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import Breadcrumbs from "./Breadcrumbs";
import ParticleBackground from "@/components/background/ParticleBackground";
import { useThemeMode } from "@/lib/useThemeMode";
import { useTiltCards } from "@/lib/useTiltCards";

export default function ErpLayout() {
  const { pathname } = useLocation();
  const [revealed, setRevealed] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const sideRef = useRef<HTMLDivElement>(null);
  const theme = useThemeMode();

  useTiltCards();

  const showSidebar = () => {
    clearTimeout(hideTimer.current);
    setRevealed(true);
  };

  const hideSidebar = () => {
    hideTimer.current = setTimeout(() => setRevealed(false), 220);
  };

  useEffect(() => {
    setRevealed(false);
    clearTimeout(hideTimer.current);
  }, [pathname]);

  useEffect(() => {
    const el = sideRef.current;
    if (!el) return;
    if (revealed) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }, [revealed]);

  return (
    <div className="relative min-h-screen">
      {/* Fondo animado: estrellas en oscuro (como el login), nieve en claro */}
      <ParticleBackground variant={theme === "dark" ? "stars" : "snow"} />

      <div className="relative z-10 flex h-screen overflow-hidden">
        {/* Zona sensible: al pasar el cursor por el borde izquierdo se muestra el menú */}
        <div
          onMouseEnter={showSidebar}
          className="fixed left-0 top-0 h-full w-3 z-40"
          aria-hidden="true"
        />
        <div
          ref={sideRef}
          onMouseEnter={showSidebar}
          onMouseLeave={hideSidebar}
          className={`fixed left-0 top-0 h-full z-40 ${
            revealed ? "translate-x-0" : "-translate-x-full pointer-events-none"
          }`}
          style={{ transition: "transform 250ms cubic-bezier(0.4, 0, 0.2, 1)" }}
        >
          <Sidebar collapsed={false} hovered />
        </div>
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Topbar />
          <main className="app-main flex-1 overflow-y-auto p-5 bg-surface-secondary">
            <div key={pathname} className="page-enter">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

interface PageTemplateProps {
  title: string;
  breadcrumbExtra?: { label: string; path?: string }[];
  actions?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
}

export function PageTemplate({ title, breadcrumbExtra, actions, filters, children }: PageTemplateProps) {
  return (
    <div>
      <Breadcrumbs extra={breadcrumbExtra} />
      <div className="flex items-start justify-between mb-4">
        <h1 className="text-xl font-bold text-content">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {filters && <div className="mb-4">{filters}</div>}
      {children}
    </div>
  );
}
