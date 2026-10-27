import { useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import MiniMapa from "@/modules/mapa-sismico/components/MiniMapa";
import ExpandModal from "@/components/ui/ExpandModal";
import AreaChart from "@/components/charts/AreaChart";
import HBarChart from "@/components/charts/HBarChart";
import { type ChartDatum } from "@/components/charts/BarChart";
import Combobox from "@/components/ui/Combobox";
import LiveClock from "@/components/ui/LiveClock";
import {
  IconDatabase, IconFilter, IconClock, IconDownload, IconCheck,
  IconEvents, IconMap, IconAnalytics, IconML, IconEstimate, IconAlertRule,
  IconAlertCenter, IconSource, IconReport, IconUsers, IconAudit, IconSettings, IconShield, IconInfo,
} from "@/components/ui/Icons";
import { useAuth } from "@/app/auth/AuthContext";
import { useCalidadDatos } from "./hooks/useCalidadDatos";
import { useDashboardData } from "./hooks/useDashboardData";
import { ROLE_LABELS } from "@/types/auth";
import {
  filterEvents, periodLabel, toTimeSeries, toMagnitudeBuckets,
  groupTimeSeries, periodBounds, medianDepth, meanDepth, maxMagnitudeEvent, REGION_OPTIONS,
  type TimeGranularity,
} from "@/lib/catalogo";
import {
  NOW, DATA_RANGE_LABEL, DATA_MIN_DAY, DATA_MAX_DAY,
} from "@/lib/ancla";
import { slugify, fmtDateTimeUTC5, fmtTimeUTC5, fmtDayLong } from "@/lib/format";
import { SOURCE_NAME } from "@/config/fuente";
import { exportEventsCsv, exportChartPng, copyText, csvDateName } from "@/lib/export";
import type { SeismicEvent } from "@/types";

const DEFAULT_PERIOD = "30d";
const SRC = SOURCE_NAME;

/* Opciones del buscador de regiones (25) */
const REGION_COMBO = REGION_OPTIONS.map((r) => ({ value: r.slug, label: r.name }));

const PERIODS = [
  { id: "24h", label: "24 h" },
  { id: "7d", label: "7 d" },
  { id: "30d", label: "30 d" },
];

const PERIODS_MODAL = [...PERIODS, { id: "custom", label: "Rango" }];

const MAG_OPTIONS = [
  { value: 0, label: "Todas" },
  { value: 3, label: "≥ 3.0" },
  { value: 4, label: "≥ 4.0" },
  { value: 5, label: "≥ 5.0" },
];

const ALL_ROWS = 1000000;
const ROW_OPTIONS = [5, 10, 25, 50, ALL_ROWS];

const inputCls =
  "px-2 py-1.5 text-xs bg-surface border border-border rounded-md text-content focus:outline-none focus:border-accent-500";
const miniBtn =
  "px-2 py-1 text-[11px] border border-border rounded-md text-content-secondary hover:bg-surface-tertiary transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const segCls = (on: boolean) =>
  `px-2.5 py-1 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
    on ? "bg-accent-600 text-white" : "bg-surface text-content-secondary hover:bg-surface-tertiary"
  }`;

/* Modales: gráfico de serie / distribución / mapa */
type ModalKind = "serie" | "dist" | "mapa";

interface ModalFilters {
  periodo: string;
  desde: string;
  hasta: string;
  zona: string;
  magmin: number;
}

/* ── Tarjetas de módulos (mismo orden/permisos que el sidebar) ── */
type ModuleStatus = "Con datos" | "Disponible";

interface TileCtx {
  events: SeismicEvent[];
  fuente: { total: number; habilitadas: number } | null;
  usuarios: number | null;
  reportes: number | null;
}

interface TileGroup {
  title: string;
  items: {
    to: string;
    label: string;
    desc: string;
    permission: string;
    status: ModuleStatus;
    stat: (ctx: TileCtx) => string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }[];
}

const TILE_GROUPS: TileGroup[] = [
  {
    title: "Monitoreo",
    items: [
      {
        to: "/eventos", label: "Eventos sísmicos", permission: "eventos", status: "Con datos",
        desc: "Catálogo completo con filtros, detalle y exportación.", icon: IconEvents,
        stat: (ctx) => `${ctx.events.length} eventos`,
      },
      {
        to: "/mapa-sismico", label: "Mapa sísmico", permission: "mapa", status: "Con datos",
        desc: "Eventos sobre los límites departamentales oficiales (INEI).", icon: IconMap,
        stat: (ctx) => `${new Set(ctx.events.map((e) => e.region).filter(Boolean)).size} regiones con eventos`,
      },
    ],
  },
  {
    title: "Analítica",
    items: [
      {
        to: "/analisis", label: "Análisis estadístico", permission: "analisis", status: "Con datos",
        desc: "Distribuciones, series y relaciones del catálogo.", icon: IconAnalytics,
        stat: (ctx) => (ctx.events.length ? `Mag. máx. ${Math.max(...ctx.events.map((e) => e.magnitude)).toFixed(1)}` : "Mag. máx. —"),
      },
      {
        to: "/preparacion-datos", label: "Preparación de datos", permission: "preparacion", status: "Disponible",
        desc: "Limpieza, deduplicación y control de calidad.", icon: IconDatabase,
        stat: () => "Datasets versionados",
      },
      {
        to: "/modelos-ml", label: "Modelos ML", permission: "modelos", status: "Disponible",
        desc: "Entrenamiento y evaluación de experimentos.", icon: IconML,
        stat: () => "Comparados con referencias",
      },
      {
        to: "/estimaciones", label: "Estimaciones", permission: "estimaciones", status: "Disponible",
        desc: "Resultados experimentales con incertidumbre.", icon: IconEstimate,
        stat: () => "Con intervalo del 90 %",
      },
    ],
  },
  {
    title: "Alertas",
    items: [
      {
        to: "/reglas-alertas", label: "Reglas de alertas", permission: "reglas", status: "Disponible",
        desc: "Condiciones, zonas y canales de notificación.", icon: IconAlertRule,
        stat: () => "Simulables antes de activar",
      },
      {
        to: "/alertas", label: "Centro de alertas", permission: "alertas", status: "Disponible",
        desc: "Seguimiento de envío, reintentos y entregas.", icon: IconAlertCenter,
        stat: () => "Aprobación, entrega y acuse",
      },
    ],
  },
  {
    title: "Datos",
    items: [
      {
        to: "/fuentes-datos", label: "Fuentes de datos", permission: "fuentes", status: "Con datos",
        desc: "Estado y sincronización del proveedor.", icon: IconSource,
        stat: (ctx) => (ctx.fuente ? `${ctx.fuente.habilitadas} / ${ctx.fuente.total} operativa` : "—"),
      },
      {
        to: "/reportes", label: "Reportes", permission: "reportes", status: "Con datos",
        desc: "Informes operativos y analíticos exportables.", icon: IconReport,
        stat: (ctx) => (ctx.reportes != null ? `${ctx.reportes} informes` : "—"),
      },
    ],
  },
  {
    title: "Administración",
    items: [
      {
        to: "/usuarios", label: "Usuarios y roles", permission: "usuarios", status: "Con datos",
        desc: "Cuentas, roles y permisos de acceso.", icon: IconUsers,
        stat: (ctx) => (ctx.usuarios != null ? `${ctx.usuarios} usuarios` : "—"),
      },
      {
        to: "/auditoria", label: "Auditoría", permission: "auditoria", status: "Con datos",
        desc: "Trazabilidad de acciones de los usuarios.", icon: IconAudit,
        stat: () => "Historial protegido",
      },
      {
        to: "/configuracion", label: "Configuración", permission: "configuracion", status: "Con datos",
        desc: "Parámetros generales de la plataforma.", icon: IconSettings,
        stat: () => "Zona UTC-5",
      },
    ],
  },
];

/* ── KPI (sin iconos, como el prototipo) ─────────────── */
function Kpi({ label, value, hint, onClick }: { label: string; value: string; hint: string; onClick?: () => void }) {
  const contenido = (
    <>
      <div className="flex items-center justify-between gap-2">
        <small className="block text-[10px] uppercase tracking-[0.04em] text-content-muted">{label}</small>
      </div>
      <b className="block text-[24px] font-bold leading-tight text-content">{value}</b>
      <span className="text-[11px] text-content-muted">{hint}</span>
    </>
  );
  const clases =
    "auth-surface tilt bg-surface border border-border rounded-[10px] px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-accent-500 hover:shadow-md";
  if (!onClick) return <div className={clases}>{contenido}</div>;
  return (
    <button type="button" onClick={onClick} className={clases} title="Ver cómo se calcula">
      {contenido}
    </button>
  );
}

/* ── Separador de sección ───────────────────────────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mt-5 mb-2">
      <span className="text-[11px] uppercase tracking-[0.08em] text-content-muted whitespace-nowrap">{children}</span>
      <i className="flex-1 h-px bg-border" aria-hidden="true" />
    </div>
  );
}

/* ── Card analítica (título + módulo + gráfico clicable + pie) ── */
function AnalyticCard({
  title, moduleLabel, to, onOpen, footer, children,
}: {
  title: string;
  moduleLabel: string;
  to: string;
  onOpen: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="auth-surface tilt bg-surface border border-border rounded-xl flex flex-col overflow-hidden min-w-0 transition-all hover:-translate-y-0.5 hover:border-accent-500 hover:shadow-md">
      <div className="flex items-start justify-between gap-2 px-3 pt-3">
        <div>
          <b className="block text-[13px] font-semibold text-content">{title}</b>
          <small className="text-[11px] text-content-muted">Módulo {moduleLabel}</small>
        </div>
        <Link to={to} className="text-[12px] text-accent-600 hover:underline whitespace-nowrap">
          Ir al módulo →
        </Link>
      </div>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ampliar ${title}`}
        title="Clic para ampliar"
        className="flex-1 min-h-0 mx-2.5 my-1.5 p-1 rounded-md text-left cursor-zoom-in hover:bg-surface-tertiary transition-colors"
      >
        {children}
      </button>
      <div className="border-t border-border px-3 py-1.5 text-[11px] text-content-muted">{footer}</div>
    </section>
  );
}

/* ── Tarjeta de módulo ──────────────────────────────── */
function ModuleCard({
  to, label, desc, status, stat, icon: Icon, ctx,
}: {
  to: string;
  label: string;
  desc: string;
  status: ModuleStatus;
  stat: (ctx: TileCtx) => string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  ctx: TileCtx;
}) {
  return (
    <Link
      to={to}
      className="auth-surface tilt group flex flex-col gap-2.5 p-3.5 bg-surface border border-border rounded-xl transition-all hover:-translate-y-0.5 hover:border-accent-500 hover:shadow-md"
      title={`Ir al módulo ${label}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-[42px] h-[42px] rounded-[10px] grid place-items-center bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400">
          <Icon size={20} />
        </div>
        <span className="ml-auto text-[10px] border border-border rounded-full px-2 py-px text-content-muted">{status}</span>
      </div>
      <div>
        <b className="block text-sm font-semibold text-content">{label}</b>
        <p className="mt-0.5 text-[12px] leading-snug text-content-muted min-h-[34px] line-clamp-2">{desc}</p>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-2 text-[12px]">
        <em className="not-italic text-content-muted">{stat(ctx)}</em>
        <span className="text-base text-accent-600 transition-transform group-hover:translate-x-0.5" aria-hidden="true">
          →
        </span>
      </div>
    </Link>
  );
}

/* ── Main ────────────────────────────────────────────── */
export default function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const { user, canAccess } = useAuth();
  const { data, cargando, error, recargar } = useDashboardData();

  /* Filtros globales (periodo / zona / magnitud mínima) — los fija la barra de filtros */
  const periodo = params.get("periodo") ?? DEFAULT_PERIOD;
  const desde = params.get("desde") ?? "";
  const hasta = params.get("hasta") ?? "";
  const zona = params.get("zona") ?? "";
  const magParam = Number(params.get("magmin"));
  const magmin = Number.isFinite(magParam) && magParam > 0 ? magParam : 0;

  const updateParams = (mut: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params);
    mut(p);
    setParams(p, { replace: true });
  };

  const setPeriodo = (id: string) =>
    updateParams((p) => {
      p.set("periodo", id);
      if (id !== "custom") {
        p.delete("desde");
        p.delete("hasta");
      }
    });

  const setZona = (value: string) =>
    updateParams((p) => {
      if (value) p.set("zona", value);
      else p.delete("zona");
    });

  const setMagmin = (value: number) =>
    updateParams((p) => {
      if (value > 0) p.set("magmin", String(value));
      else p.delete("magmin");
    });

  const clearFilters = () => setParams(new URLSearchParams(), { replace: true });

  const baseFiltered = useMemo(
    () => filterEvents(data.eventos ?? [], { periodo, desde, hasta, zona }),
    [data.eventos, periodo, desde, hasta, zona],
  );
  const filtered = useMemo(
    () => (magmin > 0 ? baseFiltered.filter((e) => e.magnitude >= magmin) : baseFiltered),
    [baseFiltered, magmin],
  );

  const timeSeries = useMemo(
    () => toTimeSeries(filtered, periodBounds(periodo, desde, hasta)),
    [filtered, periodo, desde, hasta],
  );
  const buckets = useMemo(() => toMagnitudeBuckets(filtered), [filtered]);

  const maxEv = useMemo(() => maxMagnitudeEvent(filtered), [filtered]);
  // Tipos reales del periodo filtrado (no un texto fijo): Mw, mb y ML no son comparables.
  const tiposMagnitud = useMemo(
    () => [...new Set(filtered.map((e) => e.magnitudeType ?? "sin tipo"))].sort(),
    [filtered],
  );
  const medDepth = useMemo(() => medianDepth(filtered), [filtered]);
  const avgDepth = useMemo(() => meanDepth(filtered), [filtered]);
  const onlineSources = data.fuente?.habilitadas ?? null;
  const totalSources = data.fuente?.total ?? null;
  const seismicActive = data.resumen?.active_alerts ?? null;

  const pLabel = periodLabel(periodo, desde, hasta);
  const zonaName = zona ? REGION_OPTIONS.find((r) => r.slug === zona)?.name ?? zona : "";
  const actTime = fmtTimeUTC5(NOW.toISOString());
  const regionsWithEvents = new Set(filtered.map((e) => e.region).filter(Boolean)).size; // fuera del Perú no hay departamento
  const hasActiveFilters = periodo !== DEFAULT_PERIOD || Boolean(zona) || magmin > 0;

  const filterSummary = `Filtros: ${zonaName || "Todo el Perú"}, mag ≥ ${magmin || "todas"}`;
  const eventFooter = `Fuente: ${SRC} · Periodo: ${pLabel} · ${filterSummary} · n=${filtered.length} · Act: ${actTime} (UTC-5)`;

  const seriesData: ChartDatum[] = useMemo(
    () =>
      timeSeries.map((d) => ({
        ...d,
        tip: [
          `${fmtDayLong(d.key)} (UTC-5)`,
          `${d.value} eventos (${((d.value / Math.max(filtered.length, 1)) * 100).toFixed(1)}% del periodo)`,
          `Fuente: ${SRC}`,
        ],
      })),
    [timeSeries, filtered.length],
  );

  const bucketData: ChartDatum[] = useMemo(
    () =>
      buckets.map((b) => ({
        label: b.range,
        value: b.count,
        key: b.range,
        tip: [
          `Magnitud ${b.range}`,
          `${b.count} eventos (${((b.count / Math.max(filtered.length, 1)) * 100).toFixed(1)}% del periodo)`,
          `Periodo: ${pLabel}`,
        ],
      })),
    [buckets, filtered.length, pLabel],
  );

  /* ── Estado de los modales ─────────────────────────── */
  const [expanded, setExpanded] = useState<ModalKind | null>(null);
  // Tarjeta "Mapa de eventos": Perú (sismos del periodo por departamento) o Mundo en vivo (D30).
  const [vistaMapa, setVistaMapa] = useState<"peru" | "mundo">("peru");
  const [mundoN, setMundoN] = useState<number | null>(null);
  const navigate = useNavigate();
  const [calidadOpen, setCalidadOpen] = useState(false);
  const verCalidad = canAccess("fuentes");
  const calidad = useCalidadDatos(verCalidad);
  const [mf, setMf] = useState<ModalFilters>({
    periodo: DEFAULT_PERIOD, desde: "", hasta: "", zona: "", magmin: 0,
  });
  const [gran, setGran] = useState<TimeGranularity>("day");
  const [tableRows, setTableRows] = useState(10);
  const [tableOldestFirst, setTableOldestFirst] = useState(false);
  const [tableMode, setTableMode] = useState<"eventos" | "barra">("eventos");
  const [tablePage, setTablePage] = useState(0);
  const [copiedOk, setCopiedOk] = useState(false);
  const [tabGroup, setTabGroup] = useState(0);
  const groupTabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /* Redimensionado interno de la vista ampliada: ancho del panel del mapa y alto de la tabla */
  const [anchoMapa, setAnchoMapa] = useState(420);
  const [arrastrandoMapa, setArrastrandoMapa] = useState(false);
  const [altoTabla, setAltoTabla] = useState(320);
  const [arrastrandoTabla, setArrastrandoTabla] = useState(false);

  /** Arrastra el divisor vertical: ajusta el ancho del panel de provincias/regiones. */
  const dividirMapa = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const iniX = e.clientX;
    const iniW = anchoMapa;
    setArrastrandoMapa(true);
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const mover = (ev: PointerEvent) => {
      setAnchoMapa(Math.min(Math.max(iniW - (ev.clientX - iniX), 260), 760));
    };
    const soltar = () => {
      setArrastrandoMapa(false);
      document.body.style.userSelect = prevSelect;
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  /** Arrastra el divisor horizontal: ajusta el alto de la tabla de datos. */
  const dividirTabla = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const iniY = e.clientY;
    const iniH = altoTabla;
    setArrastrandoTabla(true);
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const mover = (ev: PointerEvent) => {
      setAltoTabla(Math.min(Math.max(iniH - (ev.clientY - iniY), 120), 780));
    };
    const soltar = () => {
      setArrastrandoTabla(false);
      document.body.style.userSelect = prevSelect;
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  /* Grupos de módulos visibles según permisos */
  const visibleGroups = useMemo(
    () =>
      TILE_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canAccess(i.permission)) })).filter(
        (g) => g.items.length > 0,
      ),
    [canAccess],
  );

  /* Pestañas: "Todos" (todos los módulos, como antes) + una por categoría */
  const tabs = useMemo(
    () => [
      {
        title: "Todos",
        count: visibleGroups.reduce((s, g) => s + g.items.length, 0),
        groups: visibleGroups,
      },
      ...visibleGroups.map((g) => ({ title: g.title, count: g.items.length, groups: [g] })),
    ],
    [visibleGroups],
  );
  const gIdx = Math.min(tabGroup, Math.max(0, tabs.length - 1));
  const activeTab = tabs[gIdx];

  const openModal = (kind: ModalKind) => {
    setMf({ periodo, desde, hasta, zona, magmin });
    setTablePage(0);
    setExpanded(kind);
  };

  const patchMf = (patch: Partial<ModalFilters>) => {
    setMf((f) => ({ ...f, ...patch }));
    setTablePage(0);
  };

  /* Datos del modal (filtros propios) */
  const mBase = useMemo(
    () => filterEvents(data.eventos ?? [], { periodo: mf.periodo, desde: mf.desde, hasta: mf.hasta, zona: mf.zona }),
    [data.eventos, mf],
  );
  const mEvents = useMemo(
    () => (mf.magmin > 0 ? mBase.filter((e) => e.magnitude >= mf.magmin) : mBase),
    [mBase, mf.magmin],
  );

  const mSeries = useMemo(
    () => groupTimeSeries(mEvents, gran, periodBounds(mf.periodo, mf.desde, mf.hasta)),
    [mEvents, gran, mf.periodo, mf.desde, mf.hasta],
  );
  const mBuckets = useMemo(() => toMagnitudeBuckets(mEvents), [mEvents]);
  const mPLabel = periodLabel(mf.periodo, mf.desde, mf.hasta);
  const mZonaName = mf.zona ? REGION_OPTIONS.find((r) => r.slug === mf.zona)?.name ?? mf.zona : "";

  const sortedEvents = useMemo(() => {
    const arr = [...mEvents];
    arr.sort((a, b) =>
      tableOldestFirst ? a.occurredAt.localeCompare(b.occurredAt) : b.occurredAt.localeCompare(a.occurredAt),
    );
    return arr;
  }, [mEvents, tableOldestFirst]);

  /* Filas agregadas ("Por barra") + % acumulado para magnitud */
  const barRows = useMemo(() => {
    if (expanded === "dist") {
      const total = mBuckets.reduce((a, b) => a + b.count, 0);
      let cum = 0;
      return mBuckets.map((b) => {
        cum += b.count;
        return {
          label: b.range,
          value: b.count,
          pct: total ? (b.count / total) * 100 : 0,
          extra: total ? (cum / total) * 100 : 0,
        };
      });
    }
    const total = mSeries.reduce((a, d) => a + d.value, 0);
    return mSeries.map((d) => ({
      label: d.label,
      value: d.value,
      pct: total ? (d.value / total) * 100 : 0,
      extra: null as number | null,
    }));
  }, [expanded, mSeries, mBuckets]);

  const totalRows = tableMode === "barra" ? barRows.length : sortedEvents.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / tableRows));
  const page = Math.min(tablePage, pageCount - 1);
  const pageStart = page * tableRows;
  const barSum = barRows.reduce((a, r) => a + r.value, 0);

  /* Tabla de regiones para el modal del mapa (no depende del filtro de región) */
  const mapTable = useMemo(() => {
    const counts = new Map<string, { n: number; mx: number }>();
    mBase.forEach((e) => {
      const slug = slugify(e.region);
      const cur = counts.get(slug) ?? { n: 0, mx: 0 };
      cur.n += 1;
      cur.mx = Math.max(cur.mx, e.magnitude);
      counts.set(slug, cur);
    });
    const rows = REGION_OPTIONS.map((r) => ({
      slug: r.slug,
      name: r.name,
      n: counts.get(r.slug)?.n ?? 0,
      mx: counts.get(r.slug)?.mx ?? 0,
    })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
    return { rows, total: mBase.length };
  }, [mBase]);

  /* Enlace compartible / querystring de módulos con los filtros del modal */
  const modalQs = () => {
    const p = new URLSearchParams();
    if (mf.periodo === "custom") {
      p.set("periodo", "custom");
      if (mf.desde) p.set("desde", mf.desde);
      if (mf.hasta) p.set("hasta", mf.hasta);
    } else if (mf.periodo !== DEFAULT_PERIOD) {
      p.set("periodo", mf.periodo);
    }
    if (mf.zona) p.set("zona", mf.zona);
    if (mf.magmin > 0) p.set("magmin", String(mf.magmin));
    return p;
  };

  const shareUrl = () => {
    const p = modalQs();
    if (gran !== "day") p.set("agrupar", gran);
    const qs = p.toString();
    return `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`;
  };

  const moduleQs = () => {
    const p = modalQs();
    p.delete("agrupar");
    return p.toString();
  };

  const handleCopyLink = async () => {
    const ok = await copyText(shareUrl());
    setCopiedOk(ok);
    if (ok) window.setTimeout(() => setCopiedOk(false), 2200);
  };

  const modalTitle =
    expanded === "serie"
      ? "Vista ampliada — Eventos en el tiempo"
      : expanded === "dist"
        ? "Vista ampliada — Distribución por magnitud"
        : "Vista ampliada — Mapa de eventos (verificación por región)";

  const modalModule = expanded === "dist" ? "Análisis estadístico" : expanded === "mapa" ? "Mapa sísmico" : "Eventos sísmicos";
  const modalModuleTo = expanded === "dist" ? "/analisis" : expanded === "mapa" ? "/mapa-sismico" : "/eventos";

  const handleCsv = () => {
    if (expanded === "mapa") {
      const lines = ["region,eventos,mag_max", ...mapTable.rows.map((r) => [r.name, r.n, r.n ? r.mx.toFixed(1) : ""].join(","))];
      copyText(lines.join("\n")).then((ok) => {
        setCopiedOk(ok);
        if (ok) window.setTimeout(() => setCopiedOk(false), 2200);
      });
      return;
    }
    if (tableMode === "barra") {
      const cols = expanded === "dist" ? ["rango", "eventos", "pct", "pct_acumulado"] : ["categoria", "eventos", "pct"];
      const lines = [cols.join(",")];
      barRows.forEach((r) =>
        lines.push(
          expanded === "dist"
            ? [r.label, r.value, r.pct.toFixed(1), (r.extra ?? 0).toFixed(1)].join(",")
            : [r.label, r.value, r.pct.toFixed(1)].join(","),
        ),
      );
      copyText(lines.join("\n")).then((ok) => {
        setCopiedOk(ok);
        if (ok) window.setTimeout(() => setCopiedOk(false), 2200);
      });
      return;
    }
    exportEventsCsv(sortedEvents, csvDateName(sortedEvents));
  };

  const handlePng = () => {
    const isDist = expanded === "dist";
    if (isDist) {
      exportChartPng(mBuckets.map((b) => ({ label: b.range, value: b.count })), {
        filename: "distribucion_magnitud.png",
        title: `Distribución por magnitud — ${mPLabel}`,
        kind: "hbar",
      });
    } else {
      exportChartPng(mSeries.map((d) => ({ label: d.label, value: d.value })), {
        filename: `eventos_por_${gran}.png`,
        title: `Eventos por ${gran === "day" ? "día" : gran === "week" ? "semana" : "mes"} — ${mPLabel}`,
        kind: "area",
      });
    }
  };

  const modalFooter = (
    <span>
      Fuente: {SRC} · Periodo: {mPLabel} · Filtros: {mZonaName || "Todo el Perú"}, mag ≥ {mf.magmin || "todas"} · n=
      {expanded === "mapa" ? mapTable.total : mEvents.length} · Catálogo: {DATA_RANGE_LABEL} · Act: {actTime} (UTC-5)
    </span>
  );

  /* Bienvenida: usuario y rol de la sesión */
  const roleLabel = ROLE_LABELS[user?.role ?? "viewer"];
  const initials = (user?.fullName ?? "Invitado")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const allowedModules = TILE_GROUPS.flatMap((g) => g.items).filter((i) => canAccess(i.permission)).length;

  return (
    <div className="space-y-4">
      {/* Bienvenida + rol */}
      <section
        aria-label="Sesión actual"
        className="auth-surface tilt bg-surface border border-border rounded-[10px] px-5 py-4 flex flex-wrap items-center gap-4 transition-all hover:-translate-y-0.5 hover:border-accent-500 hover:shadow-md"
      >
        <span
          className="w-12 h-12 rounded-full bg-accent-600 text-white grid place-items-center text-sm font-bold shrink-0"
          aria-hidden="true"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-content-muted">Dashboard</p>
          <h1 className="text-2xl font-bold text-content leading-tight truncate">
            Bienvenido, {user?.fullName ?? "invitado"}
          </h1>
          <p className="text-xs text-content-muted flex items-center gap-2 flex-wrap mt-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl border border-accent-600 text-accent-600 text-[12px] font-medium">
              <IconShield size={13} />
              Rol: {roleLabel}
            </span>
            <span>{allowedModules} módulos habilitados</span>
            {user?.email && <span className="truncate">· {user.email}</span>}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-content-muted">
          <IconClock size={14} />
          <span>
            Última actualización: <LiveClock className="font-medium text-content-secondary" />
          </span>
        </div>
      </section>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-content">Resumen general</h2>
          <p className="text-xs text-content-muted mt-0.5">
            Indicadores del periodo · datos reales de la API
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2.5 text-xs text-content-secondary"
        >
          <IconInfo size={14} className="shrink-0 text-rose-600" />
          <span>No se pudieron cargar los datos del dashboard{cargando ? "" : " (revisa la API)"}.</span>
          <button
            type="button"
            onClick={recargar}
            className="ml-auto rounded-md border border-border px-2.5 py-1 font-medium text-content transition-colors hover:bg-surface-secondary"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Filtros globales */}
      <div role="group" aria-label="Filtros globales" className="auth-surface bg-surface border border-border rounded-[10px] px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <b className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-content">
          <IconFilter size={14} />
          Filtros
        </b>

        <div className="flex items-center rounded-md border border-border overflow-hidden">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" onClick={() => setPeriodo(p.id)} className={segCls(periodo === p.id)} aria-pressed={periodo === p.id}>
              {p.label}
            </button>
          ))}
        </div>

        <Combobox
          ariaLabel="Zona"
          placeholder="Zona: todo el Perú"
          value={zona}
          options={REGION_COMBO}
          onChange={setZona}
          emptyText="Sin regiones con ese nombre"
          className="w-48"
        />

        <select value={magmin} onChange={(e) => setMagmin(Number(e.target.value))} className={inputCls} aria-label="Magnitud mínima">
          {MAG_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.value === 0 ? "Magnitud: todas" : m.label}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-1.5">
          {periodo !== DEFAULT_PERIOD && (
            <span className="px-2.5 py-0.5 text-[12px] rounded-xl bg-surface-tertiary border border-border text-content-secondary">{pLabel}</span>
          )}
          {zonaName && (
            <span className="px-2.5 py-0.5 text-[12px] rounded-xl bg-surface-tertiary border border-border text-content-secondary">{zonaName}</span>
          )}
          {magmin > 0 && (
            <span className="px-2.5 py-0.5 text-[12px] rounded-xl bg-surface-tertiary border border-border text-content-secondary">mag ≥ {magmin}</span>
          )}
        </div>

        <span className="flex-1" />

        <button
          type="button"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
          className="px-3 py-1.5 text-xs border border-border rounded-md text-content-secondary hover:bg-surface-tertiary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Limpiar
        </button>

        <small className="w-full text-[11px] text-content-muted">
          Los filtros afectan solo a las cards con datos de eventos; las demás son operativas (“No afectado por filtros”).
        </small>
      </div>

      {/* KPIs */}
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        <Kpi label="Eventos en periodo" value={filtered.length.toLocaleString("es-PE")} hint={`Periodo: ${pLabel}`} />
        <Kpi
          label="Magnitud máxima"
          value={maxEv ? `${maxEv.magnitude.toFixed(1)} ${maxEv.magnitudeType ?? "—"}` : "—"}
          hint={tiposMagnitud.length ? `Tipos en el periodo: ${tiposMagnitud.join(", ")}` : "Sin eventos en el periodo"}
        />
        <Kpi label="Profundidad mediana" value={medDepth !== null ? `${medDepth} km` : "—"} hint="Del periodo filtrado" />
        <Kpi label="Profundidad media" value={avgDepth !== null ? `${avgDepth} km` : "—"} hint="Del periodo filtrado" />
        <Kpi
          label="Fuente operativa"
          value={onlineSources != null && totalSources != null ? `${onlineSources} / ${totalSources}` : "—"}
          hint={data.fuente?.nombre ?? "Sin datos de fuente"}
        />
        <Kpi
          label="Avisos internos por atender"
          value={seismicActive != null ? String(seismicActive) : "—"}
          hint={
            seismicActive != null
              ? seismicActive > 0
                ? "Por aprobar o con entrega fallida"
                : "Ninguno pendiente"
              : "Sin datos"
          }
        />
        <Kpi
          label="Calidad de datos"
          value={calidad ? `${calidad.global.pct.toFixed(1)}%` : "—"}
          hint={
            calidad
              ? `${calidad.global.pctNulos.toFixed(1)}% nulos · ${calidad.global.pctDuplicados == null ? "—" : `${calidad.global.pctDuplicados.toFixed(1)}%`} duplicados`
              : verCalidad
                ? "Calculando…"
                : "Detalle en Fuentes de datos (Analista o Administrador)"
          }
          onClick={verCalidad ? () => setCalidadOpen(true) : undefined}
        />
      </div>

      {/* Análisis del periodo */}
      <SectionTitle>Análisis del periodo</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <AnalyticCard
          title="Eventos por día"
          moduleLabel="Eventos sísmicos"
          to="/eventos"
          onOpen={() => openModal("serie")}
          footer={<span>Fuente: {SRC} · Periodo: {pLabel} · n={filtered.length} · Act: {actTime} (UTC-5)</span>}
        >
          <AreaChart data={seriesData} height={300} ariaLabel={`Eventos por día. ${filtered.length} eventos en ${pLabel}.`} />
        </AnalyticCard>

        <AnalyticCard
          title="Distribución por magnitud"
          moduleLabel="Análisis estadístico"
          to="/analisis"
          onOpen={() => openModal("dist")}
          footer={<span>Fuente: {SRC} · Periodo: {pLabel} · n={filtered.length} · Act: {actTime} (UTC-5)</span>}
        >
          <HBarChart data={bucketData} height={300} ariaLabel={`Distribución por magnitud. ${filtered.length} eventos en ${pLabel}.`} />
        </AnalyticCard>

        <AnalyticCard
          title="Mapa de eventos"
          moduleLabel="Mapa sísmico"
          to={vistaMapa === "mundo" ? "/mapa-sismico?vista=mundo" : "/mapa-sismico"}
          onOpen={vistaMapa === "mundo" ? () => navigate("/mapa-sismico?vista=mundo") : () => openModal("mapa")}
          footer={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex overflow-hidden rounded border border-border" role="group" aria-label="Vista del mapa">
                {(["peru", "mundo"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={vistaMapa === v}
                    onClick={() => setVistaMapa(v)}
                    className={`px-2 py-0.5 text-[11px] ${vistaMapa === v ? "bg-accent-600 text-white" : "text-content-secondary hover:bg-surface-tertiary"}`}
                  >
                    {v === "peru" ? "Perú" : "Mundo"}
                  </button>
                ))}
              </span>
              {vistaMapa === "peru" ? (
                <span>
                  Fuente: {SRC} · Periodo: {pLabel} · n={filtered.length} · {regionsWithEvents} de {REGION_OPTIONS.length} regiones con eventos
                </span>
              ) : (
                <span>Fuente: USGS en vivo · M4.5+ · últimos 7 días · n={mundoN ?? "—"} · no afectado por filtros</span>
              )}
            </span>
          }
        >
          <div className="chart-plot h-[300px] rounded-lg p-1">
            <MiniMapa vista={vistaMapa} regiones={filtered.map((e) => e.region)} onMundo={(d) => setMundoN(d ? d.total : null)} />
          </div>
        </AnalyticCard>
      </div>

      {/* Módulos por categoría, en pestañas (mismos permisos que el sidebar) */}
      <section aria-label="Módulos de la plataforma">
        <SectionTitle>Módulos de la plataforma</SectionTitle>

        <div
          role="tablist"
          aria-label="Categorías de módulos"
          className="flex flex-wrap gap-1.5 mb-3"
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
            e.preventDefault();
            const last = tabs.length - 1;
            const next =
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? last
                  : e.key === "ArrowRight"
                    ? (gIdx >= last ? 0 : gIdx + 1)
                    : gIdx <= 0
                      ? last
                      : gIdx - 1;
            setTabGroup(next);
            groupTabRefs.current[next]?.focus();
          }}
        >
          {tabs.map((g, i) => (
            <button
              key={g.title}
              ref={(el) => {
                groupTabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-modulos-${i}`}
              aria-selected={i === gIdx}
              aria-controls={`panel-modulos-${i}`}
              tabIndex={i === gIdx ? 0 : -1}
              onClick={() => setTabGroup(i)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                i === gIdx
                  ? "bg-accent-600 border-accent-600 text-white shadow-[0_0_18px_rgba(14,159,188,0.35)]"
                  : "bg-surface border-border text-content-secondary hover:bg-surface-tertiary"
              }`}
            >
              {g.title}
              <span className={`ml-1.5 text-[10px] ${i === gIdx ? "text-white" : "text-content-muted"}`}>
                {g.count}
              </span>
            </button>
          ))}
        </div>

        {activeTab && (
          <div
            key={gIdx}
            role="tabpanel"
            id={`panel-modulos-${gIdx}`}
            aria-labelledby={`tab-modulos-${gIdx}`}
            className="page-enter"
          >
            {activeTab.groups.map((g) => (
              <div key={g.title}>
                <SectionTitle>{g.title}</SectionTitle>
                <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(268px,1fr))]">
                  {g.items.map((item) => (
                    <ModuleCard
                      key={item.to}
                      to={item.to}
                      label={item.label}
                      desc={item.desc}
                      status={item.status}
                      stat={item.stat}
                      icon={item.icon}
                      ctx={{ events: filtered, fuente: data.fuente, usuarios: data.usuarios, reportes: data.reportes }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Vistas ampliadas */}
      {expanded && (
        <ExpandModal title={modalTitle} onClose={() => setExpanded(null)} footer={modalFooter} resizable>
          {(m) => (
          <div
            className={m.full ? "h-full min-h-0 flex flex-col gap-3" : "space-y-3"}
            style={{ ["--map-w" as string]: `${anchoMapa}px` } as CSSProperties}
          >
            {/* Filtros propios del gráfico */}
            <div className="shrink-0 auth-surface bg-surface border border-border rounded-lg px-2.5 py-2 flex flex-wrap items-end gap-x-3 gap-y-2">
              <div className="flex flex-col gap-1 text-[12px] text-content-muted">
                <label>Periodo</label>
                <div className="flex items-center rounded-md border border-border overflow-hidden">
                  {PERIODS_MODAL.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => patchMf({ periodo: p.id, ...(p.id === "custom" ? {} : { desde: "", hasta: "" }) })}
                      aria-pressed={mf.periodo === p.id}
                      className={segCls(mf.periodo === p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {mf.periodo === "custom" && (
                <div className="flex flex-col gap-1 text-[12px] text-content-muted">
                  <label>Desde / hasta</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={mf.desde}
                      min={DATA_MIN_DAY}
                      max={DATA_MAX_DAY}
                      onChange={(e) => patchMf({ desde: e.target.value })}
                      className={inputCls}
                      aria-label="Fecha inicial"
                    />
                    <input
                      type="date"
                      value={mf.hasta}
                      min={DATA_MIN_DAY}
                      max={DATA_MAX_DAY}
                      onChange={(e) => patchMf({ hasta: e.target.value })}
                      className={inputCls}
                      aria-label="Fecha final"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-1 text-[12px] text-content-muted">
                <label>Región</label>
                <Combobox
                  ariaLabel="Buscar región"
                  placeholder="Todas las regiones"
                  value={mf.zona}
                  options={REGION_COMBO}
                  onChange={(slug) => patchMf({ zona: slug })}
                  emptyText="Sin regiones con ese nombre"
                  className="w-48"
                />
              </div>

              <div className="flex flex-col gap-1 text-[12px] text-content-muted">
                <label>Magnitud mínima</label>
                <select value={mf.magmin} onChange={(e) => patchMf({ magmin: Number(e.target.value) })} className={inputCls} aria-label="Magnitud mínima">
                  {MAG_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {expanded === "serie" && (
                <div className="flex flex-col gap-1 text-[12px] text-content-muted">
                  <label>Agrupar</label>
                  <div className="flex items-center rounded-md border border-border overflow-hidden">
                    {([
                      ["day", "Día"],
                      ["week", "Semana"],
                      ["month", "Mes"],
                    ] as const).map(([g, lab]) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGran(g)}
                        aria-pressed={gran === g}
                        className={segCls(gran === g)}
                      >
                        {lab}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5 w-full">
                <span className="px-2.5 py-0.5 text-[12px] rounded-xl bg-surface border border-border text-content-secondary">{mPLabel}</span>
                {mZonaName && (
                  <span className="px-2.5 py-0.5 text-[12px] rounded-xl bg-surface border border-border text-content-secondary">{mZonaName}</span>
                )}
                {mf.magmin > 0 && (
                  <span className="px-2.5 py-0.5 text-[12px] rounded-xl bg-surface border border-border text-content-secondary">mag ≥ {mf.magmin}</span>
                )}
                <button
                  type="button"
                  onClick={() => setMf({ periodo, desde, hasta, zona, magmin })}
                  className="ml-auto px-3 py-1 text-xs border border-border rounded-md text-content-secondary hover:bg-surface transition-colors"
                >
                  Restablecer
                </button>
              </div>
            </div>

            {/* Acciones */}
            <div className="shrink-0 flex flex-wrap items-center gap-2">
              <button type="button" onClick={handleCsv} className={miniBtn} title="Descargar/copiar los datos de este gráfico">
                <IconDownload size={13} className="inline -mt-0.5 mr-1" />
                {expanded === "mapa" ? "Copiar CSV" : tableMode === "barra" ? "Copiar CSV" : `CSV (${sortedEvents.length})`}
              </button>
              {expanded !== "mapa" && (
                <button type="button" onClick={handlePng} disabled={mEvents.length === 0} className={miniBtn} title="Descargar este gráfico como imagen PNG">
                  <IconDownload size={13} className="inline -mt-0.5 mr-1" />
                  PNG
                </button>
              )}
              <button type="button" onClick={handleCopyLink} className={miniBtn} title={shareUrl()}>
                {copiedOk && <IconCheck size={13} className="inline -mt-0.5 mr-1" />}
                {copiedOk ? "Copiado" : "Copiar enlace"}
              </button>
              <span className="ml-auto flex items-center gap-2 text-xs text-content-muted">
                Abrir en:
                <Link to={`${modalModuleTo}?${moduleQs()}`} className={miniBtn}>
                  Módulo {expanded === "mapa" ? "Mapa" : expanded === "dist" ? "Análisis" : "Eventos"}
                </Link>
              </span>
            </div>

            {/* Gráfico ampliado */}
            {expanded === "serie" && (
              <div className={m.full ? "flex-1 min-h-0" : undefined}>
                <AreaChart
                  data={mSeries.map((d) => ({
                    ...d,
                    tip: [
                      `${d.label} (UTC-5)`,
                      `${d.value} eventos (${((d.value / Math.max(mEvents.length, 1)) * 100).toFixed(1)}% de la selección)`,
                      `Fuente: ${SRC}`,
                    ],
                  }))}
                  height={320}
                  fill={m.full}
                  ariaLabel={`Eventos agrupados por ${gran}. ${mEvents.length} eventos en ${mPLabel}.`}
                />
              </div>
            )}

            {expanded === "dist" && (
              <div className={m.full ? "flex-1 min-h-0" : undefined}>
                <HBarChart
                  data={mBuckets.map((b) => ({
                    label: b.range,
                    value: b.count,
                    key: b.range,
                    tip: [`Magnitud ${b.range}`, `${b.count} eventos`, `Fuente: ${SRC}`],
                  }))}
                  height={320}
                  fill={m.full}
                  ariaLabel={`Distribución por magnitud. ${mEvents.length} eventos en ${mPLabel}.`}
                />
              </div>
            )}

            {expanded === "mapa" && (
              <div className={m.full ? "relative flex-1 min-h-0" : "relative"}>
                <div className={m.full ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,var(--map-w))] gap-3.5 h-full" : "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,var(--map-w))] gap-3.5"}>
                  {/* Capa base pendiente: sin GeoJSON oficial no se dibuja geografía */}
                  <div className={`chart-plot flex min-h-[300px] items-center justify-center rounded-lg px-6 text-center ${m.full ? "h-full" : ""}`}>
                    <div>
                      <p className="text-sm font-semibold text-content">Mapa por departamento</p>
                      <p className="mt-1 text-xs text-content-muted">
                        Los eventos sobre los límites oficiales están en el{" "}
                        <Link to="/mapa-sismico" className="font-medium text-accent-700 underline dark:text-accent-300">Mapa sísmico</Link>.
                      </p>
                    </div>
                  </div>

                  {/* Divisor arrastrable: ajusta el ancho del panel de regiones */}
                  <div
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Ajustar el ancho del panel de regiones"
                    tabIndex={0}
                    onPointerDown={dividirMapa}
                    onDoubleClick={() => setAnchoMapa(420)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        setAnchoMapa((w) => Math.min(w + 24, 760));
                      } else if (e.key === "ArrowRight") {
                        e.preventDefault();
                        setAnchoMapa((w) => Math.max(w - 24, 260));
                      }
                    }}
                    title="Arrastra para ajustar el ancho del panel (doble clic restablece)"
                    className={`hidden lg:block w-1.5 shrink-0 cursor-col-resize touch-none rounded-full transition-colors focus:outline-none ${
                      arrastrandoMapa ? "bg-accent-500" : "bg-border hover:bg-accent-500 focus-visible:bg-accent-500"
                    }`}
                  />

                  <div className={m.full ? "min-h-0 flex flex-col" : ""}>
                    <div className={m.full ? "chart-plot flex-1 min-h-0 overflow-auto rounded-lg" : "chart-plot overflow-auto rounded-lg max-h-[420px]"}>
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-surface-tertiary z-10">
                          <tr className="text-left text-content-muted">
                            <th className="px-3 py-1.5 font-medium">Región</th>
                            <th className="px-3 py-1.5 font-medium text-right">Eventos</th>
                            <th className="px-3 py-1.5 font-medium text-right">%</th>
                            <th className="px-3 py-1.5 font-medium text-right">Mag. máx.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mapTable.rows.map((r) => (
                            <tr
                              key={r.slug}
                              onClick={() => patchMf({ zona: mf.zona === r.slug ? "" : r.slug })}
                              className={`border-b border-border last:border-0 cursor-pointer hover:bg-surface-tertiary ${
                                mf.zona === r.slug ? "bg-surface-tertiary font-bold" : ""
                              }`}
                              title={`Filtrar por ${r.name}`}
                            >
                              <td className="px-3 py-1.5 text-content">{r.name}</td>
                              <td className="px-3 py-1.5 text-right text-content-secondary">{r.n}</td>
                              <td className="px-3 py-1.5 text-right text-content-secondary">
                                {mapTable.total ? `${((r.n / mapTable.total) * 100).toFixed(1)}%` : "—"}
                              </td>
                              <td className="px-3 py-1.5 text-right text-content-secondary">{r.n ? r.mx.toFixed(1) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="font-bold bg-surface-tertiary">
                            <td className="px-3 py-1.5 text-content">Total</td>
                            <td className="px-3 py-1.5 text-right text-content">{mapTable.total}</td>
                            <td className="px-3 py-1.5 text-right text-content">100%</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <p className="mt-1.5 shrink-0 text-[11px] text-content-muted">
                      Las {REGION_OPTIONS.length} regiones suman n={mapTable.total}. Las regiones son solo nombres: no hay provincias ni contornos inventados.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Divisor arrastrable: ajusta el alto de la tabla de datos */}
            {expanded !== "mapa" && (
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label="Ajustar el alto de la tabla de datos"
                tabIndex={0}
                onPointerDown={dividirTabla}
                onDoubleClick={() => setAltoTabla(320)}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setAltoTabla((h) => Math.min(h + 24, 780));
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setAltoTabla((h) => Math.max(h - 24, 120));
                }
              }}
              title="Arrastra para ajustar el alto de la tabla (doble clic restablece)"
              className={`hidden lg:block h-1.5 shrink-0 cursor-row-resize touch-none rounded-full transition-colors focus:outline-none ${
                arrastrandoTabla ? "bg-accent-500" : "bg-border hover:bg-accent-500 focus-visible:bg-accent-500"
              }`}
            />
            )}

            {/* Tabla de datos (solo gráficos) */}
            {expanded !== "mapa" && (
              <div className={`chart-plot rounded-lg overflow-hidden ${m.full ? "shrink-0" : ""}`}>
                <div className="flex items-center gap-2 flex-wrap bg-surface-tertiary px-2.5 py-1.5 text-[11px] text-content-muted">
                  <b className="font-semibold text-content">
                    Tabla de datos — {tableMode === "barra" ? "por barra del gráfico" : "eventos del gráfico"}
                  </b>
                  <span>{totalRows} filas</span>
                  {tableMode === "barra" && (
                    <span>
                      {barSum === mEvents.length
                        ? `✓ La suma coincide con n=${mEvents.length}`
                        : `✗ La suma (${barSum}) no coincide con n=${mEvents.length}`}
                    </span>
                  )}
                  <span className="flex-1" />

                  <div className="flex items-center rounded-md border border-border overflow-hidden">
                    <button type="button" onClick={() => { setTableMode("eventos"); setTablePage(0); }} aria-pressed={tableMode === "eventos"} className={segCls(tableMode === "eventos")}>
                      Eventos
                    </button>
                    <button type="button" onClick={() => { setTableMode("barra"); setTablePage(0); }} aria-pressed={tableMode === "barra"} className={segCls(tableMode === "barra")}>
                      Por barra
                    </button>
                  </div>

                  <label className="flex items-center gap-1">
                    Filas
                    <select
                      value={tableRows}
                      onChange={(e) => { setTableRows(Number(e.target.value)); setTablePage(0); }}
                      className="px-1.5 py-1 text-[11px] bg-surface border border-border rounded-md text-content focus:outline-none focus:border-accent-500"
                      aria-label="Filas visibles"
                    >
                      {ROW_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n === ALL_ROWS ? "Todas" : n}</option>
                      ))}
                    </select>
                  </label>

                  {tableMode === "eventos" && (
                    <div className="flex items-center rounded-md border border-border overflow-hidden">
                      <button type="button" onClick={() => { setTableOldestFirst(false); setTablePage(0); }} aria-pressed={!tableOldestFirst} className={segCls(!tableOldestFirst)}>
                        Últimos
                      </button>
                      <button type="button" onClick={() => { setTableOldestFirst(true); setTablePage(0); }} aria-pressed={tableOldestFirst} className={segCls(tableOldestFirst)}>
                        Primeros
                      </button>
                    </div>
                  )}

                  <span>
                    {totalRows ? pageStart + 1 : 0}–{Math.min(totalRows, pageStart + tableRows)} de {totalRows}
                  </span>
                  <button type="button" onClick={() => setTablePage((p) => Math.max(0, p - 1))} disabled={page === 0} className={miniBtn} aria-label="Página anterior">
                    ◀
                  </button>
                  <button type="button" onClick={() => setTablePage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} className={miniBtn} aria-label="Página siguiente">
                    ▶
                  </button>
                </div>

                <div className="overflow-auto" style={{ maxHeight: altoTabla }}>
                  {tableMode === "barra" ? (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-surface z-10">
                        <tr className="text-left text-content-muted border-b border-border">
                          <th className="px-3 py-1.5 font-medium">{expanded === "dist" ? "Rango" : "Categoría"}</th>
                          <th className="px-3 py-1.5 font-medium text-right">Eventos</th>
                          <th className="px-3 py-1.5 font-medium text-right">%</th>
                          {expanded === "dist" && <th className="px-3 py-1.5 font-medium text-right">% acumulado</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {barRows.slice(pageStart, pageStart + tableRows).map((r, i) => (
                          <tr key={`${r.label}-${i}`} className="border-b border-border last:border-0">
                            <td className="px-3 py-1.5 text-content">{r.label}</td>
                            <td className="px-3 py-1.5 text-right text-content-secondary">{r.value}</td>
                            <td className="px-3 py-1.5 text-right text-content-secondary">{r.pct.toFixed(1)}%</td>
                            {expanded === "dist" && (
                              <td className="px-3 py-1.5 text-right text-content-secondary">{(r.extra ?? 0).toFixed(1)}%</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-bold bg-surface-tertiary">
                          <td className="px-3 py-1.5 text-content">Total</td>
                          <td className="px-3 py-1.5 text-right text-content">{barSum}</td>
                          <td className="px-3 py-1.5 text-right text-content">100%</td>
                          {expanded === "dist" && <td />}
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-surface z-10">
                        <tr className="text-left text-content-muted border-b border-border">
                          <th className="px-3 py-1.5 font-medium">Fecha (UTC-5)</th>
                          <th className="px-3 py-1.5 font-medium">Ubicación</th>
                          <th className="px-3 py-1.5 font-medium text-right">Magnitud</th>
                          <th className="px-3 py-1.5 font-medium text-right">Profundidad</th>
                          <th className="px-3 py-1.5 font-medium">Fuente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedEvents.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-content-muted">
                              Sin eventos para estos filtros.
                            </td>
                          </tr>
                        ) : (
                          sortedEvents.slice(pageStart, pageStart + tableRows).map((e) => (
                            <tr key={e.id} className="border-b border-border last:border-0">
                              <td className="px-3 py-1.5 whitespace-nowrap text-content-secondary" title={`${e.occurredAt} (UTC)`}>
                                {fmtDateTimeUTC5(e.occurredAt)}
                              </td>
                              <td className="px-3 py-1.5 text-content">{e.place}</td>
                              <td className="px-3 py-1.5 text-right whitespace-nowrap font-bold text-content">
                                {e.magnitude.toFixed(1)} {e.magnitudeType ?? "—"}
                              </td>
                              <td className="px-3 py-1.5 text-right whitespace-nowrap text-content-secondary">{e.depthKm ?? "—"} km</td>
                              <td className="px-3 py-1.5 text-content-secondary">{e.sourceName}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
          )}
        </ExpandModal>
      )}

      {calidadOpen && (
        <ExpandModal title="Calidad de datos" onClose={() => setCalidadOpen(false)}>
          <div className="space-y-3 text-[12px] leading-relaxed text-content-secondary">
            <p>
              El indicador se calcula con la misma función y la misma selección que la tabla de calidad de{" "}
              <Link to="/fuentes-datos" className="text-accent-600 hover:underline">Fuentes de datos</Link>: el catálogo de eventos
              recibidos de la fuente.
            </p>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="font-mono text-[11px] text-content">
                % nulos = Σ campos nulos ÷ (eventos × campos) <br />
                % duplicados = Σ duplicados omitidos ÷ Σ registros leídos <br />
                calidad = 100 − % nulos − % duplicados
              </p>
            </div>
            {calidad ? (
              <>
                <ul className="grid gap-1">
                  <li>Eventos de la selección: <b className="text-content">{calidad.global.totalEventos}</b></li>
                  <li>Nulos en todos los campos: <b className="text-content">{calidad.global.pctNulos.toFixed(1)}%</b></li>
                  <li>
                    Duplicados omitidos:{" "}
                    <b className="text-content">{calidad.global.pctDuplicados == null ? "—" : `${calidad.global.pctDuplicados.toFixed(1)}%`}</b>
                    {calidad.global.pctDuplicados == null ? " (sin base para calcularlo)" : ""}
                  </li>
                  <li>Calidad resultante: <b className="text-content">{calidad.global.pct.toFixed(1)}%</b></li>
                </ul>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="text-left text-content-muted">
                      <th className="py-1 pr-3 font-medium">Campo</th>
                      <th className="py-1 pr-3 font-medium">Nulos</th>
                      <th className="py-1 font-medium">% nulos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calidad.campos.map((c) => (
                      <tr key={c.campo} className="border-t border-border">
                        <td className="py-1 pr-3 font-mono text-content">{c.campo}</td>
                        <td className="py-1 pr-3 tabular-nums">
                          {c.nulos} de {c.total}
                        </td>
                        <td className="py-1 tabular-nums">{c.pctNulos.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p>Calculando…</p>
            )}
          </div>
        </ExpandModal>
      )}
    </div>
  );
}
