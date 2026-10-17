import { useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ExpandModal from "@/components/ui/ExpandModal";
import AreaChart from "@/components/charts/AreaChart";
import HBarChart from "@/components/charts/HBarChart";
import { type ChartDatum } from "@/components/charts/BarChart";
import RegionMap from "@/components/charts/RegionMap";
import Combobox from "@/components/ui/Combobox";
import LiveClock from "@/components/ui/LiveClock";
import {
  IconDatabase, IconFilter, IconClock, IconDownload, IconCheck,
  IconEvents, IconMap, IconAnalytics, IconML, IconEstimate, IconAlertRule,
  IconAlertCenter, IconSource, IconReport, IconUsers, IconAudit, IconSettings, IconShield,
} from "@/components/ui/Icons";
import { useAuth } from "@/app/auth/AuthContext";
import { ROLE_LABELS } from "@/types/auth";
import {
  mockEvents, mockSources, mockAlerts, mockUsers, NOW,
  filterEvents, inPeriod, periodLabel, toTimeSeries, toMagnitudeBuckets,
  groupTimeSeries, medianDepth, maxMagnitudeEvent, slugify,
  fmtDateTimeUTC5, fmtTimeUTC5, fmtDayLong,
  REGION_OPTIONS, DATA_RANGE_LABEL, DATA_MIN_DAY, DATA_MAX_DAY,
  type TimeGranularity,
} from "@/lib/mock/data";
import { exportEventsCsv, exportChartPng, copyText, csvDateName } from "@/lib/export";
import { provinceStats, provinceDistricts, ALL_PROVINCES, findProvince } from "@/lib/mock/provinces";
import type { SeismicEvent } from "@/types";

const DEFAULT_PERIOD = "30d";
const SRC = "IGP";

/* Opciones del buscador de provincias (197, con su región) */
const PROVINCE_OPTIONS = ALL_PROVINCES.map((p) => ({
  value: p.name,
  label: p.name,
  hint: p.deptName,
}));

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
type ModuleStatus = "Con datos" | "Vacío" | "Capa pendiente";

interface TileGroup {
  title: string;
  items: {
    to: string;
    label: string;
    desc: string;
    permission: string;
    status: ModuleStatus;
    stat: (events: SeismicEvent[]) => string;
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
        stat: (E) => `${E.length} eventos`,
      },
      {
        to: "/mapa", label: "Mapa sísmico", permission: "mapa", status: "Capa pendiente",
        desc: "Distribución geográfica; la capa base se cargará aquí.", icon: IconMap,
        stat: (E) => `${new Set(E.map((e) => e.region)).size} regiones con eventos`,
      },
    ],
  },
  {
    title: "Analítica",
    items: [
      {
        to: "/analisis", label: "Análisis estadístico", permission: "analisis", status: "Con datos",
        desc: "Distribuciones, series y relaciones del catálogo.", icon: IconAnalytics,
        stat: (E) => (E.length ? `Mag. máx. ${Math.max(...E.map((e) => e.magnitude)).toFixed(1)}` : "Mag. máx. —"),
      },
      {
        to: "/preparacion-datos", label: "Preparación de datos", permission: "preparacion", status: "Con datos",
        desc: "Limpieza, deduplicación y control de calidad.", icon: IconDatabase,
        stat: () => "Calidad 99.4%",
      },
      {
        to: "/modelos-ml", label: "Modelos ML", permission: "modelos", status: "Vacío",
        desc: "Entrenamiento y evaluación de experimentos.", icon: IconML,
        stat: () => "0 experimentos",
      },
      {
        to: "/estimaciones", label: "Estimaciones", permission: "estimaciones", status: "Vacío",
        desc: "Resultados experimentales con incertidumbre.", icon: IconEstimate,
        stat: () => "0 publicadas",
      },
    ],
  },
  {
    title: "Alertas",
    items: [
      {
        to: "/reglas-alertas", label: "Reglas de alertas", permission: "reglas", status: "Con datos",
        desc: "Condiciones, zonas y canales de notificación.", icon: IconAlertRule,
        stat: () => "3 activas",
      },
      {
        to: "/alertas", label: "Centro de alertas", permission: "alertas", status: "Con datos",
        desc: "Seguimiento de envío, reintentos y entregas.", icon: IconAlertCenter,
        stat: () => `${mockAlerts.filter((a) => a.status === "failed").length} fallidas`,
      },
    ],
  },
  {
    title: "Datos",
    items: [
      {
        to: "/fuentes-datos", label: "Fuentes de datos", permission: "fuentes", status: "Con datos",
        desc: "Estado y sincronización del proveedor (IGP).", icon: IconSource,
        stat: () => `${mockSources.filter((s) => s.status === "online").length} / ${mockSources.length} operativa`,
      },
      {
        to: "/reportes", label: "Reportes", permission: "reportes", status: "Con datos",
        desc: "Informes operativos y analíticos exportables.", icon: IconReport,
        stat: () => "12 generados",
      },
    ],
  },
  {
    title: "Administración",
    items: [
      {
        to: "/usuarios", label: "Usuarios y roles", permission: "usuarios", status: "Con datos",
        desc: "Cuentas, roles y permisos de acceso.", icon: IconUsers,
        stat: () => `${mockUsers.length} usuarios`,
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
function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="auth-surface tilt bg-surface border border-border rounded-[10px] px-3.5 py-3">
      <small className="block text-[10px] uppercase tracking-[0.04em] text-content-muted">{label}</small>
      <b className="block text-[24px] font-bold leading-tight text-content">{value}</b>
      <span className="text-[11px] text-content-muted">{hint}</span>
    </div>
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
    <section className="auth-surface tilt bg-surface border border-border rounded-xl flex flex-col overflow-hidden min-w-0">
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
  to, label, desc, status, stat, icon: Icon, events,
}: {
  to: string;
  label: string;
  desc: string;
  status: ModuleStatus;
  stat: (events: SeismicEvent[]) => string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  events: SeismicEvent[];
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
        <em className="not-italic text-content-muted">{stat(events)}</em>
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
    () => filterEvents(mockEvents, { periodo, desde, hasta, zona }),
    [periodo, desde, hasta, zona],
  );
  const filtered = useMemo(
    () => (magmin > 0 ? baseFiltered.filter((e) => e.magnitude >= magmin) : baseFiltered),
    [baseFiltered, magmin],
  );

  const timeSeries = useMemo(() => toTimeSeries(filtered), [filtered]);
  const buckets = useMemo(() => toMagnitudeBuckets(filtered), [filtered]);

  const maxEv = useMemo(() => maxMagnitudeEvent(filtered), [filtered]);
  const medDepth = useMemo(() => medianDepth(filtered), [filtered]);
  const onlineSources = mockSources.filter((s) => s.status === "online").length;
  const seismicActive = mockAlerts.filter(
    (a) => a.kind === "seismic" && a.status === "pending" && inPeriod(a.createdAt, { periodo, desde, hasta, zona }),
  ).length;

  const pLabel = periodLabel(periodo, desde, hasta);
  const zonaName = zona ? REGION_OPTIONS.find((r) => r.slug === zona)?.name ?? zona : "";
  const actTime = fmtTimeUTC5(NOW.toISOString());
  const regionsWithEvents = new Set(filtered.map((e) => e.region)).size;
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
  const [mf, setMf] = useState<ModalFilters>({
    periodo: DEFAULT_PERIOD, desde: "", hasta: "", zona: "", magmin: 0,
  });
  const [gran, setGran] = useState<TimeGranularity>("day");
  const [selProv, setSelProv] = useState<string | null>(null);
  const [zoneCard, setZoneCard] = useState(false);
  const [tableRows, setTableRows] = useState(10);
  const [tableOldestFirst, setTableOldestFirst] = useState(false);
  const [tableMode, setTableMode] = useState<"eventos" | "barra">("eventos");
  const [tablePage, setTablePage] = useState(0);
  const [copiedOk, setCopiedOk] = useState(false);
  const [tabGroup, setTabGroup] = useState(0);
  const groupTabRefs = useRef<(HTMLButtonElement | null)[]>([]);

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
    setSelProv(null);
    setZoneCard(false);
    setExpanded(kind);
  };

  const patchMf = (patch: Partial<ModalFilters>) => {
    if (patch.zona !== undefined) setSelProv(null);
    setZoneCard(false);
    setMf((f) => ({ ...f, ...patch }));
    setTablePage(0);
  };

  /**
   * Selecciona una provincia. `openCard` = viene del mapa, del punto rojo o de la tabla
   * (abre la ficha de zonas y alterna al repetir el clic); el buscador solo resalta.
   */
  const pickProvince = (name: string, openCard: boolean) => {
    const sameOpen = selProv === name && zoneCard;
    setSelProv(sameOpen ? null : name);
    setZoneCard(sameOpen ? false : openCard);
  };

  /* Datos del modal (filtros propios) */
  const mBase = useMemo(
    () => filterEvents(mockEvents, { periodo: mf.periodo, desde: mf.desde, hasta: mf.hasta, zona: mf.zona }),
    [mf],
  );
  const mEvents = useMemo(
    () => (mf.magmin > 0 ? mBase.filter((e) => e.magnitude >= mf.magmin) : mBase),
    [mBase, mf.magmin],
  );

  const mSeries = useMemo(() => groupTimeSeries(mEvents, gran), [mEvents, gran]);
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

  /* Provincias de la región seleccionada en el modal del mapa */
  const regionEvents = useMemo(
    () => (mf.zona ? mBase.filter((e) => slugify(e.region) === mf.zona) : []),
    [mBase, mf.zona],
  );
  const provStats = useMemo(() => {
    if (!mf.zona) return [];
    const maxMag = regionEvents.reduce((a, e) => Math.max(a, e.magnitude), 0);
    return provinceStats(mf.zona, regionEvents.length, maxMag);
  }, [mf.zona, regionEvents]);
  const selStat = provStats.find((p) => p.name === selProv) ?? null;
  const selDistricts = selStat ? provinceDistricts(mf.zona, selStat.name, selStat.n, selStat.mx) : [];
  const regionTotal = regionEvents.length;
  const regionMax = regionEvents.reduce((a, e) => Math.max(a, e.magnitude), 0);

  /* Eventos por región para la vista previa del mapa en el dashboard */
  const regionCounts = useMemo(() => {
    const out: Record<string, number> = {};
    filtered.forEach((e) => {
      const s = slugify(e.region);
      out[s] = (out[s] ?? 0) + 1;
    });
    return out;
  }, [filtered]);

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
  const modalModuleTo = expanded === "dist" ? "/analisis" : expanded === "mapa" ? "/mapa" : "/eventos";

  const handleCsv = () => {
    if (expanded === "mapa") {
      const lines =
        mf.zona && provStats.length > 0
          ? ["region,provincia,eventos,pct,mag_max", ...provStats.map((p) =>
              [
                mZonaName,
                p.name,
                p.n,
                regionTotal ? ((p.n / regionTotal) * 100).toFixed(1) : "0",
                p.n ? p.mx.toFixed(1) : "",
              ].join(","),
            )]
          : ["region,eventos,mag_max", ...mapTable.rows.map((r) => [r.name, r.n, r.n ? r.mx.toFixed(1) : ""].join(","))];
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
      Fuente: {SRC} · Periodo: {mPLabel} · Filtros: {mZonaName || "Todo el Perú"}
      {selStat ? ` · Provincia: ${selStat.name}` : ""}, mag ≥ {mf.magmin || "todas"} · n=
      {expanded === "mapa" ? (mf.zona ? regionTotal : mapTable.total) : mEvents.length} · Catálogo: {DATA_RANGE_LABEL} · Act: {actTime} (UTC-5)
    </span>
  );

  /* Bienvenida: usuario y rol de la sesión (mock, sin backend) */
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
        className="auth-surface tilt bg-surface border border-border rounded-[10px] px-5 py-4 flex flex-wrap items-center gap-4"
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
            Indicadores del periodo · datos de ejemplo (mock, sin backend)
          </p>
        </div>
      </div>

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
          value={maxEv ? `${maxEv.magnitude.toFixed(1)} ${maxEv.magnitudeType}` : "—"}
          hint="Tipo: Mw/ML mixto"
        />
        <Kpi label="Profundidad mediana" value={medDepth !== null ? `${medDepth} km` : "—"} hint="Del periodo filtrado" />
        <Kpi label="Fuente operativa" value={`${onlineSources} / ${mockSources.length}`} hint={`${SRC} · latencia ${mockSources[0]?.latencyMs ?? 0} ms`} />
        <Kpi
          label="Alertas sísmicas activas"
          value={String(seismicActive)}
          hint={seismicActive ? `${seismicActive} pendientes de envío` : "Sin alertas vigentes"}
        />
        <Kpi label="Calidad de datos" value="99.4%" hint="0.3% nulos · 0.3% duplicados" />
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
          to="/mapa"
          onOpen={() => openModal("mapa")}
          footer={
            <span>
              Fuente: {SRC} · Periodo: {pLabel} · n={filtered.length} · {regionsWithEvents} de {REGION_OPTIONS.length} regiones con eventos
            </span>
          }
        >
          <div className="w-full h-[300px]">
            <RegionMap preview regionCounts={regionCounts} />
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
                      events={filtered}
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
        <ExpandModal title={modalTitle} onClose={() => setExpanded(null)} footer={modalFooter}>
          {(m) => (
          <div className={m.full ? "h-full min-h-0 flex flex-col gap-3" : "space-y-3"}>
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

              {expanded === "mapa" && (
                <div className="flex flex-col gap-1 text-[12px] text-content-muted">
                  <label>Provincia</label>
                  <Combobox
                    ariaLabel="Buscar provincia"
                    placeholder="Escribe una provincia…"
                    value={selProv ?? ""}
                    options={PROVINCE_OPTIONS}
                    onChange={(name) => {
                      const p = findProvince(name);
                      if (!p) {
                        patchMf({ zona: "" });
                        return;
                      }
                      if (p.deptSlug !== mf.zona) patchMf({ zona: p.deptSlug });
                      pickProvince(p.name, false);
                    }}
                    emptyText="Sin provincias con ese nombre"
                    className="w-56"
                  />
                </div>
              )}

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
                {selStat && (
                  <span className="px-2.5 py-0.5 text-[12px] rounded-xl border border-accent-600 bg-surface text-accent-600">
                    Provincia: {selStat.name}
                  </span>
                )}
                {mf.magmin > 0 && (
                  <span className="px-2.5 py-0.5 text-[12px] rounded-xl bg-surface border border-border text-content-secondary">mag ≥ {mf.magmin}</span>
                )}
                <button
                  type="button"
                  onClick={() => { setMf({ periodo, desde, hasta, zona, magmin }); setSelProv(null); }}
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
                <div className={m.full ? "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-3.5 h-full" : "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-3.5"}>
                  <RegionMap
                    regionSlug={mf.zona}
                    regionName={mZonaName}
                    provinces={provStats}
                    selProv={selProv}
                    onSelectProv={(name) => pickProvince(name, true)}
                    onSelectRegion={(slug) => patchMf({ zona: slug })}
                    onReset={() => patchMf({ zona: "" })}
                    maxTotal={regionTotal}
                  />

                  <div className={m.full ? "min-h-0 flex flex-col" : ""}>
                    {mf.zona ? (
                      <>
                        <div className={m.full ? "chart-plot flex-1 min-h-0 overflow-auto rounded-lg" : "chart-plot overflow-auto rounded-lg max-h-[420px]"}>
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-surface-tertiary z-10">
                              <tr className="text-left text-content-muted">
                                <th className="px-3 py-1.5 font-medium">Provincia</th>
                                <th className="px-3 py-1.5 font-medium text-right">Eventos</th>
                                <th className="px-3 py-1.5 font-medium text-right">%</th>
                                <th className="px-3 py-1.5 font-medium text-right">Mag. máx.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {provStats.map((p) => (
                                <tr
                                  key={p.name}
                                  onClick={() => pickProvince(p.name, true)}
                                  className={`border-b border-border last:border-0 cursor-pointer hover:bg-surface-tertiary ${
                                    selProv === p.name ? "bg-surface-tertiary font-bold" : ""
                                  }`}
                                  title={`Ver zonas afectadas de ${p.name}`}
                                >
                                  <td className="px-3 py-1.5 text-content">{p.name}</td>
                                  <td className="px-3 py-1.5 text-right text-content-secondary">{p.n}</td>
                                  <td className="px-3 py-1.5 text-right text-content-secondary">
                                    {regionTotal ? `${((p.n / regionTotal) * 100).toFixed(1)}%` : "—"}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-content-secondary">{p.n ? p.mx.toFixed(1) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="font-bold bg-surface-tertiary">
                                <td className="px-3 py-1.5 text-content">{mZonaName || "Región"}</td>
                                <td className="px-3 py-1.5 text-right text-content">{regionTotal}</td>
                                <td className="px-3 py-1.5 text-right text-content">100%</td>
                                <td className="px-3 py-1.5 text-right text-content">{regionMax ? regionMax.toFixed(1) : "—"}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        <p className="mt-1.5 shrink-0 text-[11px] text-content-muted">
                          {provStats.length} provincias de {mZonaName} suman n={regionTotal}. Clic en una provincia o en su punto rojo para ver las zonas afectadas.
                        </p>
                      </>
                    ) : (
                      <>
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
                                  title={`Acercar el mapa a ${r.name}`}
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
                          Las {REGION_OPTIONS.length} regiones suman n={mapTable.total}. Clic en una región para ver sus provincias y ubicaciones.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Ficha centrada: ubicación + zonas afectadas */}
                {selStat && zoneCard && (
                  <div className="fixed inset-0 z-[110] grid place-items-center p-4">
                    <div
                      className="absolute inset-0 bg-black/45"
                      onClick={() => setZoneCard(false)}
                      aria-hidden="true"
                    />
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-label={`Zonas afectadas en ${selStat.name}, ${mZonaName}`}
                      className="auth-surface relative border border-border rounded-xl shadow-2xl w-full max-w-xl max-h-[86vh] flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-border shrink-0">
                        <div>
                          <p className="text-[11px] uppercase tracking-widest text-content-muted">
                            Provincia de {mZonaName}
                          </p>
                          <h3 className="text-base font-bold text-content flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ background: "var(--danger)" }}
                              aria-hidden="true"
                            />
                            {selStat.name}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setZoneCard(false)}
                          className="p-1.5 rounded-md text-content-muted hover:text-content hover:bg-surface-tertiary transition-colors"
                          aria-label="Cerrar ficha de la provincia"
                        >
                          ×
                        </button>
                      </div>

                      <div className="px-5 py-3 border-b border-border grid grid-cols-3 gap-2 text-center shrink-0">
                        <div>
                          <p className="text-[11px] text-content-muted">Eventos</p>
                          <p className="text-lg font-bold text-content">{selStat.n}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-content-muted">Mag. máx.</p>
                          <p className="text-lg font-bold text-content">{selStat.mx ? selStat.mx.toFixed(1) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-content-muted">% de {mZonaName}</p>
                          <p className="text-lg font-bold text-content">
                            {regionTotal ? `${((selStat.n / regionTotal) * 100).toFixed(1)}%` : "—"}
                          </p>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto px-5 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold text-content">
                            Zonas afectadas ({selDistricts.length})
                          </h4>
                          <span className="text-[11px] text-content-muted">distritos, ordenados por eventos</span>
                        </div>
                        {selDistricts.length === 0 ? (
                          <p className="text-xs text-content-muted py-6 text-center">
                            Sin zonas afectadas en el periodo seleccionado (0 eventos en esta provincia).
                          </p>
                        ) : (
                          <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                            {selDistricts.map((d) => (
                              <li key={d.name} className="flex items-center gap-3 px-3 py-2 text-xs">
                                <span className="text-content">{d.name}</span>
                                <span className="ml-auto text-content-secondary">{d.n} eventos</span>
                                <span className="w-16 text-right text-content-secondary">
                                  {d.mx ? `mag ${d.mx.toFixed(1)}` : "—"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="mt-2 text-[11px] text-content-muted">
                          Distritos simulados (frontend) para la demostración · Periodo: {mPLabel} · Fuente: {SRC}
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-surface-secondary rounded-b-xl shrink-0">
                        <button
                          type="button"
                          onClick={() => patchMf({ zona: "" })}
                          className={miniBtn}
                        >
                          Ver todo el Perú
                        </button>
                        <button type="button" onClick={() => setZoneCard(false)} className={miniBtn}>
                          Cerrar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tabla de datos (solo gráficos) */}
            {expanded !== "mapa" && (
              <div className={`chart-plot rounded-lg overflow-hidden ${m.full ? "shrink-0" : ""}`}>
                <div className="flex items-center gap-2 flex-wrap bg-surface-tertiary px-2.5 py-1.5 text-[11px] text-content-muted">
                  <b className="font-semibold text-content">
                    Tabla de datos — {tableMode === "barra" ? "por barra del gráfico" : "eventos del gráfico"}
                  </b>
                  <span>{totalRows} filas · mostrando {Math.min(tableRows, Math.max(0, totalRows - pageStart))}</span>
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
                </div>

                <div className="overflow-auto max-h-[320px]">
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
                                {e.magnitude.toFixed(1)} {e.magnitudeType}
                              </td>
                              <td className="px-3 py-1.5 text-right whitespace-nowrap text-content-secondary">{e.depthKm} km</td>
                              <td className="px-3 py-1.5 text-content-secondary">{e.sourceName}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex items-center gap-2 justify-end mt-1.5 text-[11px] text-content-muted">
                  {tableMode === "barra" && (
                    <span className="mr-auto">
                      {barSum === mEvents.length
                        ? `✓ La suma coincide con n=${mEvents.length}`
                        : `✗ La suma (${barSum}) no coincide con n=${mEvents.length}`}
                    </span>
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
              </div>
            )}
          </div>
          )}
        </ExpandModal>
      )}
    </div>
  );
}
