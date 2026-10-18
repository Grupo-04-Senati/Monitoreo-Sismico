import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { NOW } from "@/lib/ancla";
import { fmtTimeUTC5 } from "@/lib/format";
import { SOURCE_NAME } from "@/config/fuente";
import type { SeismicEvent } from "@/types";
import { IconInfo } from "@/components/ui/Icons";
import { cargarCatalogo } from "@/modules/eventos/services/eventos.service";
import type { DefinicionGrafico, FiltrosAnalisis, IdGrafico, ResultadoAnalisis } from "./types";
import {
  CLAVES_ANALISIS,
  CLAVES_DATOS,
  DEFINICIONES,
  FILTROS_POR_DEFECTO,
  chipsDesdeFiltros,
  filtroSinChip,
  hayFiltrosAnalisis,
} from "./schemas/analisis.schema";
import { calcular, desdeCatalogo, eventosFiltrados } from "./services/analisis.service";
import { tablaDeGrafico } from "./lib/tablas";
import AvisoAnalisis from "./components/AvisoAnalisis";
import FiltrosAnalisisPanel from "./components/FiltrosAnalisis";
import ChipsAnalisis from "./components/ChipsAnalisis";
import TarjetasKpi from "./components/TarjetasKpi";
import TarjetaGrafico from "./components/TarjetaGrafico";
import TablaDatos from "./components/TablaDatos";
import { GraficoResultado } from "./components/Graficos";
import PanelGrafico from "./components/PanelGrafico";
import PanelEventos from "./components/PanelEventos";
import ModalIndicador from "./components/ModalIndicador";

const PNG: Partial<Record<IdGrafico, string>> = {
  ts: "analisis_serie_temporal",
  mh: "analisis_magnitud",
  sc: "analisis_dispersion",
  rg: "analisis_regiones",
  dh: "analisis_profundidad",
};

/* Etiqueta corta para la barra de pestañas (el título completo va en la tarjeta) */
const TAB_LABEL: Partial<Record<IdGrafico, string>> = {
  ts: "Serie temporal",
  mh: "Magnitud",
  sc: "Dispersión",
  rg: "Por región",
  dh: "Profundidad",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center gap-3">
      <span className="whitespace-nowrap text-[11px] uppercase tracking-[0.08em] text-content-muted">{children}</span>
      <i className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}

interface EventosSeleccion {
  titulo: string;
  info: string;
  eventos: SeismicEvent[];
}

function metaDe(id: IdGrafico, r: ResultadoAnalisis): string {
  const base = `n=${r.n}${r.faltantes ? ` · faltantes=${r.faltantes}` : ""} · Fuente: ${SOURCE_NAME}`;
  if (id === "ts" && r.serie.nota) return `${base} · ${r.serie.nota}`;
  if (id === "sc") return `${base} · ${r.dispersion.nota}`;
  return base;
}

export default function AnalisisPage() {
  const [filtros, setFiltros] = useState<FiltrosAnalisis>(FILTROS_POR_DEFECTO);
  const [panelId, setPanelId] = useState<IdGrafico | null>(null);
  const [eventosSel, setEventosSel] = useState<EventosSeleccion | null>(null);
  const [kpiIdx, setKpiIdx] = useState<number | null>(null);
  const [tabGrafico, setTabGrafico] = useState(0);
  const tabGraficoRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [catalogo, setCatalogo] = useState<SeismicEvent[] | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    setError(false);
    cargarCatalogo()
      .then((filas) => {
        if (vivo) setCatalogo(filas.map(desdeCatalogo));
      })
      .catch(() => {
        if (vivo) setError(true);
      });
    return () => {
      vivo = false;
    };
  }, [intento]);

  const resultado = useMemo(
    () => (catalogo ? calcular(filtros, catalogo) : null),
    [filtros, catalogo],
  );
  const chips = useMemo(
    () => (resultado ? chipsDesdeFiltros(filtros, resultado.etiquetaPeriodo) : []),
    [filtros, resultado],
  );
  const eventosOrden = useMemo(
    () =>
      catalogo
        ? [...eventosFiltrados(filtros, catalogo)].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        : [],
    [filtros, catalogo],
  );

  const cambiar = (parcial: Partial<FiltrosAnalisis>) => setFiltros((f) => ({ ...f, ...parcial }));
  const limpiar = () => setFiltros({ ...FILTROS_POR_DEFECTO });
  const quitarChip = (clave: Parameters<typeof filtroSinChip>[0]) =>
    setFiltros((f) => ({ ...f, ...filtroSinChip(clave) }));

  const definicion = DEFINICIONES.find((d) => d.id === panelId) ?? null;
  const actTime = fmtTimeUTC5(NOW.toISOString());

  if (!catalogo) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        {error ? (
          <>
            <p role="alert" className="flex items-center justify-center gap-2 text-sm text-content-secondary">
              <IconInfo size={15} className="text-rose-600" />
              No se pudo conectar con la API de eventos.
            </p>
            <button
              type="button"
              onClick={() => setIntento((n) => n + 1)}
              className="mt-4 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-content transition-colors hover:bg-surface-secondary"
            >
              Reintentar
            </button>
          </>
        ) : (
          <p className="text-sm text-content-muted">Cargando catálogo de eventos…</p>
        )}
      </div>
    );
  }
  if (!resultado) return null;

  /* Gráficos en pestañas · tablas aparte */
  const graficos = DEFINICIONES.filter((d) => d.tipo !== "tabla");
  const tablas = DEFINICIONES.filter((d) => d.tipo === "tabla");
  const gi = Math.min(tabGrafico, Math.max(0, graficos.length - 1));
  const graficoActivo = graficos[gi];

  /** Tarjeta de un gráfico o tabla (mismo comportamiento en pestañas y tablas). */
  const tarjeta = (def: DefinicionGrafico, altura: number) => {
    const t = tablaDeGrafico(def.id, resultado);
    const propios = def.filtros.filter((k) => CLAVES_ANALISIS.includes(k));
    return (
      <TarjetaGrafico
        key={def.id}
        titulo={def.titulo}
        subtitulo={def.subtitulo}
        info={def.info}
        png={PNG[def.id]}
        csv={{ columnas: t.columnas.map((c) => c.etiqueta), filas: t.filas }}
        tabla={def.tipo === "tabla" ? undefined : { columnas: t.columnas, filas: t.filas }}
        meta={metaDe(def.id, resultado)}
        ancho={def.ancho}
        controles={
          propios.length > 0 ? (
            <FiltrosAnalisisPanel filtros={filtros} onCambiar={cambiar} incluir={propios} variante="plano" />
          ) : undefined
        }
        onAmpliar={() => setPanelId(def.id)}
      >
        {def.tipo === "tabla" ? (
          <TablaDatos
            columnas={t.columnas}
            filas={def.id === "ev" ? t.filas.slice(0, 6) : t.filas}
            maxAltura="max-h-[300px]"
            onFila={
              def.id === "ev"
                ? (i) => {
                    const e = eventosOrden[i];
                    if (e)
                      setEventosSel({
                        titulo: `Evento ${e.id}`,
                        info: "Evento seleccionado en la tabla.",
                        eventos: [e],
                      });
                  }
                : undefined
            }
          />
        ) : (
          <GraficoResultado
            id={def.id}
            resultado={resultado}
            height={altura}
            maxAlto={altura + 60}
            onBarClick={(p) =>
              setEventosSel({
                titulo: `${p.label} — eventos`,
                info: "Eventos que componen la barra seleccionada.",
                eventos: p.eventos,
              })
            }
            onPointClick={(p) =>
              setEventosSel({
                titulo: `Evento ${p.evento.id}`,
                info: "Evento seleccionado en la dispersión.",
                eventos: [p.evento],
              })
            }
          />
        )}
      </TarjetaGrafico>
    );
  };

  return (
    <div>
      {/* Encabezado */}
      <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-xs text-content-muted">
        <Link to="/" className="transition-colors hover:text-content">
          Inicio
        </Link>
        <span aria-hidden="true">/</span>
        <span>Analítica</span>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-content-secondary">Análisis estadístico</span>
      </nav>

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Análisis estadístico</h1>
          <p className="mt-0.5 text-xs text-content-muted">
            Descripción de la historia y la distribución de eventos · Ejecutado: {actTime} (UTC-5)
          </p>
        </div>
      </div>

      {/* Aviso fijo */}
      <AvisoAnalisis />

      {/* Filtros */}
      <FiltrosAnalisisPanel filtros={filtros} onCambiar={cambiar} incluir={CLAVES_DATOS} />
      <ChipsAnalisis chips={chips} onQuitar={quitarChip} onLimpiar={limpiar} />

      {/* Indicadores */}
      <TarjetasKpi kpis={resultado.kpis} onAbrir={setKpiIdx} />

      {/* Gráficos en pestañas */}
      <SectionTitle>Gráficos</SectionTitle>
      <div
        role="tablist"
        aria-label="Gráficos del análisis"
        className="mb-3 flex flex-wrap gap-1.5"
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
          e.preventDefault();
          const last = graficos.length - 1;
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? last
                : e.key === "ArrowRight"
                  ? (gi >= last ? 0 : gi + 1)
                  : gi <= 0
                    ? last
                    : gi - 1;
          setTabGrafico(next);
          tabGraficoRefs.current[next]?.focus();
        }}
      >
        {graficos.map((def, i) => (
          <button
            key={def.id}
            ref={(el) => {
              tabGraficoRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-grafico-${def.id}`}
            aria-selected={i === gi}
            aria-controls={`panel-grafico-${def.id}`}
            tabIndex={i === gi ? 0 : -1}
            onClick={() => setTabGrafico(i)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              i === gi
                ? "border-accent-600 bg-accent-600 text-white shadow-[0_0_18px_rgba(14,159,188,0.35)]"
                : "border-border bg-surface text-content-secondary hover:bg-surface-tertiary"
            }`}
          >
            {TAB_LABEL[def.id] ?? def.titulo}
          </button>
        ))}
      </div>

      {graficoActivo && (
        <div
          key={graficoActivo.id}
          role="tabpanel"
          id={`panel-grafico-${graficoActivo.id}`}
          aria-labelledby={`tab-grafico-${graficoActivo.id}`}
          className="page-enter"
        >
          {tarjeta(graficoActivo, 300)}
        </div>
      )}

      {/* Tablas */}
      <SectionTitle>Tablas</SectionTitle>
      <div className="grid grid-cols-1 gap-3">
        {tablas.map((def) => tarjeta(def, 240))}
      </div>

      {/* Pie */}
      <p className="mt-3 text-[11px] text-content-muted">
        Fuente: {SOURCE_NAME} · Eje Y de barras desde 0; ejes de dispersión ajustados al rango de datos · Colores
        neutros: no indican nivel de peligro.
      </p>

      {/* Modales */}
      {definicion && (
        <PanelGrafico definicion={definicion} filtrosIniciales={filtros} catalogo={catalogo} onCerrar={() => setPanelId(null)} />
      )}
      {eventosSel && (
        <PanelEventos
          titulo={eventosSel.titulo}
          info={eventosSel.info}
          eventos={eventosSel.eventos}
          meta={`Fuente: ${SOURCE_NAME} · Periodo: ${resultado.etiquetaPeriodo} · Filtros: ${resultado.etiquetaFiltros}`}
          onCerrar={() => setEventosSel(null)}
        />
      )}
      {kpiIdx != null && resultado.kpis[kpiIdx] && (
        <ModalIndicador
          kpi={resultado.kpis[kpiIdx]}
          meta={`Fuente: ${SOURCE_NAME} · Periodo: ${resultado.etiquetaPeriodo} · ${resultado.etiquetaFiltros} · Act: ${actTime} (UTC-5)`}
          onCerrar={() => setKpiIdx(null)}
        />
      )}
    </div>
  );
}
