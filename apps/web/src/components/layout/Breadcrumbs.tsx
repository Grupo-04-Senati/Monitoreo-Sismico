import { Link, useLocation } from "react-router";

interface Crumb {
  label: string;
  path?: string;
}

const CRUMB_MAP: Record<string, string> = {
  "/": "Dashboard",
  "/eventos": "Eventos",
  "/mapa-sismico": "Mapa sísmico",
  "/analisis": "Análisis estadístico",
  "/preparacion-datos": "Preparación de datos",
  "/modelos-ml": "Modelos ML",
  "/estimaciones": "Estimaciones experimentales",
  "/reglas-alertas": "Reglas de alertas",
  "/alertas": "Centro de alertas",
  "/fuentes-datos": "Fuentes de datos",
  "/reportes": "Reportes",
  "/usuarios": "Usuarios y roles",
  "/auditoria": "Auditoría",
  "/configuracion": "Configuración",
};

export default function Breadcrumbs({ extra }: { extra?: Crumb[] }) {
  const location = useLocation();
  const path = location.pathname;
  const mainLabel = CRUMB_MAP[path] ?? "Página";
  const crumbs: Crumb[] = [{ label: "Inicio", path: "/" }, { label: mainLabel }];

  if (extra) crumbs.push(...extra);

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-content-muted mb-1">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">/</span>}
          {crumb.path ? (
            <Link to={crumb.path} className="hover:text-content transition-colors">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-content-secondary font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
