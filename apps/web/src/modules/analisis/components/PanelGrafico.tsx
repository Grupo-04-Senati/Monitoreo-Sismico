import { useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { SeismicEvent } from "@/types";
import ExpandModal from "@/components/ui/ExpandModal";
import { IconClose, IconDownload, IconEvents, IconReport } from "@/components/ui/Icons";
import { exportFilasCsv, exportSvgPng } from "@/lib/export";
import { slugify } from "@/lib/format";
import { SOURCE_NAME } from "@/config/fuente";
import { calcular, eventosFiltrados } from "../services/analisis.service";
import { tablaDeGrafico } from "../lib/tablas";
import type { DefinicionGrafico, FiltrosAnalisis } from "../types";
import FiltrosAnalisisPanel from "./FiltrosAnalisis";
import { GraficoResultado } from "./Graficos";
import { Paginador, SelectorFilas } from "./Controles";
import TablaDatos from "./TablaDatos";
import ListaEventos from "./ListaEventos";

interface PanelGraficoProps {
  definicion: DefinicionGrafico;
  filtrosIniciales: FiltrosAnalisis;
  catalogo: SeismicEvent[];
  onCerrar: () => void;
}

interface DetalleEventos {
  titulo: string;
  info: string;
  eventos: SeismicEvent[];
}

const botonIcono =
  "inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-content-secondary transition-colors hover:bg-surface-tertiary";

/** Altura del gráfico en la vista ampliada: mediana, ni diminuta ni gigante. */
const ALTO_GRAFICO = 300;

/**
 * Vista ampliada de un gráfico: filtros propios, gráfico a lo ancho (alto
 * mediano) y su tabla. La barra superior concentra acciones y la paginación va
 * arriba. Al tocar una barra, un punto o una fila, el detalle se muestra como
 * PANEL LATERAL dentro del mismo modal (sin apilar modales).
 */
export default function PanelGrafico({ definicion, filtrosIniciales, catalogo, onCerrar }: PanelGraficoProps) {
  const [filtros, setFiltros] = useState<FiltrosAnalisis>(filtrosIniciales);
  const [pagina, setPagina] = useState(0);
  const [tamano, setTamano] = useState(10);
  const [detalle, setDetalle] = useState<DetalleEventos | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const filaRef = useRef<HTMLDivElement>(null);
  const [anchoPanel, setAnchoPanel] = useState(420);
  const [arrastrando, setArrastrando] = useState(false);

  const resultado = useMemo(() => calcular(filtros, catalogo), [filtros, catalogo]);
  const tabla = useMemo(() => tablaDeGrafico(definicion.id, resultado), [definicion.id, resultado]);
  const eventosOrden = useMemo(
    () => [...eventosFiltrados(filtros, catalogo)].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [filtros, catalogo],
  );
  const base = slugify(definicion.titulo) || "grafico";

  const cambiar = (parcial: Partial<FiltrosAnalisis>) => {
    setFiltros((f) => ({ ...f, ...parcial }));
    setPagina(0);
    setDetalle(null);
  };

  const esTabla = definicion.tipo === "tabla";
  const inicio = pagina * tamano;
  const filasPagina = tabla.filas.slice(inicio, inicio + tamano);

    const meta = `Fuente: ${SOURCE_NAME} · Periodo: ${resultado.etiquetaPeriodo} · Filtros: ${resultado.etiquetaFiltros} · n=${resultado.n}`;

  const verEventos = (titulo: string, info: string, eventos: SeismicEvent[]) =>
    setDetalle({ titulo, info, eventos });

  /** Abre el mismo panel lateral al tocar una fila de la tabla. */
  const abrirFila = (i: number) => {
    const info = "Eventos que componen la fila seleccionada.";
    switch (definicion.id) {
      case "ts": {
        const p = resultado.serie.puntos[i];
        if (p) verEventos(`${p.label} — eventos`, info, p.eventos);
        break;
      }
      case "mh": {
        const p = resultado.magnitudes.puntos[i];
        if (p) verEventos(`${p.label} — eventos`, info, p.eventos);
        break;
      }
      case "dh": {
        const p = resultado.profundidades.puntos[i];
        if (p) verEventos(`${p.label} — eventos`, info, p.eventos);
        break;
      }
      case "rg": {
        const p = resultado.regiones.puntos[i];
        if (p) verEventos(`${p.label} — eventos`, info, p.eventos);
        break;
      }
      case "sc": {
        const p = resultado.dispersion.puntos[i];
        if (p) verEventos(`Evento ${p.evento.id}`, "Evento seleccionado en la tabla.", [p.evento]);
        break;
      }
      case "ev": {
        const e = eventosOrden[i];
        if (e) verEventos(`Evento ${e.id}`, "Evento seleccionado en la tabla.", [e]);
        break;
      }
    }
  };

  /** Arrastra el divisor para cambiar el ancho del panel lateral. */
  const dividir = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const iniX = e.clientX;
    const iniW = anchoPanel;
    const fila = filaRef.current;
    const maxW = fila ? Math.max(300, fila.clientWidth - 360) : 760;
    setArrastrando(true);
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const mover = (ev: PointerEvent) => {
      setAnchoPanel(Math.min(Math.max(iniW - (ev.clientX - iniX), 280), maxW));
    };
    const soltar = () => {
      setArrastrando(false);
      document.body.style.userSelect = prevSelect;
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  return (
    <ExpandModal title={`Vista ampliada — ${definicion.titulo}`} onClose={onCerrar} footer={meta} resizable>
      <div
        ref={filaRef}
        className="flex flex-col gap-4 lg:h-full lg:min-h-0 lg:flex-row lg:items-stretch"
        style={{ ["--panel-w" as string]: `${anchoPanel}px` } as CSSProperties}
      >
        {/* Columna principal */}
        <div className="min-w-0 flex-1 lg:min-h-0">
          <p className="mb-3 text-[11px] text-content-muted">{definicion.info}</p>

          {/* Filtros propios del gráfico */}
          <div className="mb-3 rounded-lg border border-border bg-surface px-3.5 py-3">
            <FiltrosAnalisisPanel filtros={filtros} onCambiar={cambiar} incluir={definicion.filtros} variante="plano" />
          </div>

          {!esTabla && (
            <div className="mb-3 min-w-0">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-content-muted">
                  {resultado.n} eventos · {tabla.filas.length} filas
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      verEventos(
                        "Eventos de la selección",
                        "Todos los eventos que cumplen los filtros de esta vista.",
                        eventosOrden,
                      )
                    }
                    className={botonIcono}
                    title="Ver los eventos de estos filtros"
                  >
                    <IconEvents size={13} />
                    Eventos (n={resultado.n})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const svg = chartRef.current?.querySelector("svg");
                      if (svg) exportSvgPng(svg as SVGSVGElement, `${base}.png`, { scale: 2 });
                    }}
                    className={botonIcono}
                  >
                    <IconDownload size={13} />
                    PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => exportFilasCsv(tabla.columnas.map((c) => c.etiqueta), tabla.filas, `${base}.csv`)}
                    className={botonIcono}
                  >
                    <IconReport size={13} />
                    CSV
                  </button>
                </div>
              </div>
              <div ref={chartRef} className="chart-plot rounded-lg px-2 py-2">
                <GraficoResultado
                  id={definicion.id}
                  resultado={resultado}
                  height={ALTO_GRAFICO}
                  maxAlto={ALTO_GRAFICO}
                  onBarClick={(p) =>
                    verEventos(`${p.label} — eventos`, "Eventos que componen la barra seleccionada.", p.eventos)
                  }
                  onPointClick={(p) =>
                    verEventos(`Evento ${p.evento.id}`, "Evento seleccionado en la dispersión.", [p.evento])
                  }
                />
              </div>
              <p className="mt-1 text-[11px] text-content-muted">
                Toca una barra, un punto o una fila de la tabla para ver los eventos que lo componen.
              </p>
              {definicion.id === "ts" && resultado.serie.nota && (
                <p className="mt-0.5 text-[11px] text-content-muted">{resultado.serie.nota}</p>
              )}
              {definicion.id === "sc" && (
                <p className="mt-0.5 text-[11px] text-content-muted">{resultado.dispersion.nota}</p>
              )}
            </div>
          )}

          {/* Barra superior de la tabla: filas por página + paginación */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-content-muted">{tabla.total.toLocaleString("es-PE")} filas</span>
            <SelectorFilas
              tamano={tamano}
              onCambiar={(n) => {
                setTamano(n);
                setPagina(0);
              }}
            />
          </div>
          <Paginador total={tabla.filas.length} pagina={pagina} tamano={tamano} onPagina={setPagina} />

          <TablaDatos
            columnas={tabla.columnas}
            filas={filasPagina}
            desde={inicio}
            maxAltura="max-h-[42vh]"
            onFila={definicion.id === "st" ? undefined : abrirFila}
          />
        </div>

        {/* Divisor arrastrable: ajusta el ancho del panel lateral */}
        {detalle && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Ajustar el ancho del panel de detalle"
            tabIndex={0}
            onPointerDown={dividir}
            onDoubleClick={() => setAnchoPanel(420)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                setAnchoPanel((w) => Math.min(w + 24, 760));
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                setAnchoPanel((w) => Math.max(w - 24, 280));
              }
            }}
            title="Arrastra para ajustar el ancho del panel (doble clic restablece)"
            className={`hidden w-1.5 shrink-0 cursor-col-resize touch-none rounded-full transition-colors focus:outline-none lg:block ${
              arrastrando ? "bg-accent-500" : "bg-border hover:bg-accent-500 focus-visible:bg-accent-500"
            }`}
          />
        )}

        {/* Panel lateral de detalle (dentro del mismo modal) */}
        {detalle && (
          <aside className="flex w-full shrink-0 flex-col rounded-lg border border-border bg-surface lg:sticky lg:top-0 lg:h-full lg:w-[var(--panel-w)]">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
              <b className="min-w-0 truncate text-xs font-semibold text-content">{detalle.titulo}</b>
              <button
                type="button"
                onClick={() => setDetalle(null)}
                className="rounded-md p-1 text-content-muted transition-colors hover:bg-surface-tertiary hover:text-content"
                aria-label="Cerrar detalle"
              >
                <IconClose size={14} />
              </button>
            </div>
            <div className="flex flex-1 min-h-0 flex-col p-3">
              <p className="mb-2 text-[11px] text-content-muted">{detalle.info}</p>
              <ListaEventos eventos={detalle.eventos} fill tamanoInicial={5} />
            </div>
          </aside>
        )}
      </div>
    </ExpandModal>
  );
}
