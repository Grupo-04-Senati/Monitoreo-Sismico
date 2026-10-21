import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Link } from "react-router";
import { SOURCE_NAME } from "@/config/fuente";
import { DATA_RANGE_LABEL } from "@/lib/ancla";
import { fmtTimeUTC5 } from "@/lib/format";
import { useMeta } from "@/lib/useMeta";
import { useFiltrosMapaURL } from "./hooks/useFiltrosMapaURL";
import { useGeoJSON } from "./hooks/useGeoJSON";
import { chipsDesdeFiltros, resumenFiltros } from "./schemas/filtros.schema";
import { cargarEventosMapa, eventosFiltrados, resumirRegiones } from "./services/mapa.service";
import AvisoMapa from "./components/AvisoMapa";
import FiltrosMapa from "./components/FiltrosMapa";
import ChipsMapa from "./components/ChipsMapa";
import MapaBase from "./components/MapaBase";
import PanelRegiones from "./components/PanelRegiones";
import ModalMapa from "./components/ModalMapa";
import DetalleEventoModal from "@/modules/eventos/components/DetalleEventoModal";
import type { EventoSismico } from "@/types";
import { IconClock, IconExpand } from "@/components/ui/Icons";

export default function MapaPage() {
  const { filtros, errores, hayFiltros, setFiltros, quitarChip, limpiar } = useFiltrosMapaURL();
  const { geo, error: errorGeo, nombreArchivo, cargar, limpiar: limpiarGeo } = useGeoJSON();

  const metaIso = useMeta();
  const [catalogo, setCatalogo] = useState<EventoSismico[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [eventoSel, setEventoSel] = useState<number | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  /* Ancho del panel de regiones: se ajusta arrastrando el divisor entre el mapa y el panel */
  const [anchoPanel, setAnchoPanel] = useState(330);
  const [arrastrando, setArrastrando] = useState(false);

  const dividirPanel = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const iniX = e.clientX;
    const iniW = anchoPanel;
    setArrastrando(true);
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const mover = (ev: PointerEvent) => {
      setAnchoPanel(Math.min(Math.max(iniW - (ev.clientX - iniX), 240), 640));
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

  useEffect(() => {
    let vivo = true;
    setError(null);
    cargarEventosMapa()
      .then((d) => {
        if (vivo) setCatalogo(d);
      })
      .catch((e) => {
        if (vivo) {
          setCatalogo(null);
          setError((e as { detail?: string; message?: string })?.detail ?? (e as Error)?.message ?? "No se pudieron cargar los eventos.");
        }
      });
    return () => {
      vivo = false;
    };
  }, [intento]);

  const eventos = useMemo(() => (catalogo ? eventosFiltrados(catalogo, filtros) : []), [catalogo, filtros]);
  const regiones = useMemo(() => resumirRegiones(eventos), [eventos]);
  const chips = useMemo(() => chipsDesdeFiltros(filtros), [filtros]);

  const radio =
    filtros.rlat != null && filtros.rlon != null && filtros.radioKm != null
      ? { lat: filtros.rlat, lon: filtros.rlon, km: filtros.radioKm }
      : null;

  const actTime = fmtTimeUTC5(metaIso);
  const evento = eventoSel != null ? eventos[eventoSel] ?? null : null;

  return (
    <div>
      {/* Encabezado */}
      <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-xs text-content-muted">
        <Link to="/" className="transition-colors hover:text-content">
          Inicio
        </Link>
        <span aria-hidden="true">/</span>
        <span>Monitoreo</span>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-content-secondary">Mapa sísmico</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Mapa sísmico</h1>
          <p className="mt-0.5 text-xs text-content-muted">Exploración espacial de eventos observados y zonas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-content-muted">
            <IconClock size={14} />
            Actualizado: <b className="font-medium text-content-secondary">{actTime}</b> (UTC-5)
          </span>
          <button
            type="button"
            onClick={() => setModalAbierto(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-tertiary"
          >
            <IconExpand size={14} />
            Vista ampliada
          </button>
        </div>
      </div>

      <AvisoMapa />

      <FiltrosMapa filtros={filtros} errores={errores} hayFiltros={hayFiltros} onCambiar={setFiltros} onLimpiar={limpiar} />

      <ChipsMapa chips={chips} onQuitar={quitarChip} onLimpiar={limpiar} />

      {/* Mapa + panel de regiones */}
      {error ? (
        <div className="rounded-lg border border-border bg-surface px-4 py-10 text-center">
          <p className="text-sm font-semibold text-content">No se pudo conectar con el backend</p>
          <p className="mt-1 text-xs text-content-muted">{error}</p>
          <button
            type="button"
            onClick={() => setIntento((n) => n + 1)}
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-content hover:bg-surface-tertiary"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div
          className="grid gap-3 lg:h-[calc(100vh-19rem)] lg:min-h-[420px] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,var(--panel-w))]"
          style={{ ["--panel-w" as string]: `${anchoPanel}px` } as CSSProperties}
        >
        <MapaBase
          geo={geo}
          errorGeo={errorGeo}
          nombreArchivo={nombreArchivo}
          onCargarArchivo={cargar}
          onLimpiarArchivo={limpiarGeo}
          eventos={eventos}
          regiones={regiones}
          capa={filtros.capa}
          radio={radio}
          fuente={SOURCE_NAME}
          actualizado={actTime}
          onRegionClick={(slug) => setFiltros({ region: slug })}
          onEventoClick={setEventoSel}
          onAbrirModal={() => setModalAbierto(true)}
        />

        {/* Divisor arrastrable: ajusta el ancho del panel de regiones */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajustar el ancho del panel de regiones"
          aria-valuenow={anchoPanel}
          aria-valuemin={240}
          aria-valuemax={640}
          tabIndex={0}
          onPointerDown={dividirPanel}
          onDoubleClick={() => setAnchoPanel(330)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              setAnchoPanel((w) => Math.min(w + 24, 640));
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              setAnchoPanel((w) => Math.max(w - 24, 240));
            }
          }}
          title="Arrastra para ajustar el ancho del panel (doble clic restablece)"
          className={`hidden lg:block w-1.5 shrink-0 cursor-col-resize touch-none rounded-full transition-colors focus:outline-none ${
            arrastrando ? "bg-accent-500" : "bg-border hover:bg-accent-500 focus-visible:bg-accent-500"
          }`}
        />

        <PanelRegiones regiones={regiones} total={eventos.length} regionActiva={filtros.region} onRegionClick={(slug) => setFiltros({ region: slug })} />
      </div>
      )}

      {/* Pie */}
      <p className="mt-3 text-[11px] text-content-muted">
        Fuente: {SOURCE_NAME} · {resumenFiltros(filtros)} · n={catalogo ? eventos.length.toLocaleString("es-PE") : "—"} · Catálogo:{" "}
        {DATA_RANGE_LABEL || "—"} · Actualizado: {actTime} (UTC-5)
      </p>

      {/* Detalle de evento */}
      {evento && (
        <DetalleEventoModal
          evento={evento}
          posicion={(eventoSel ?? 0) + 1}
          total={eventos.length}
          hayAnterior={eventoSel != null && eventoSel > 0}
          haySiguiente={eventoSel != null && eventoSel < eventos.length - 1}
          onCerrar={() => setEventoSel(null)}
          onAnterior={() => setEventoSel((s) => (s == null ? s : Math.max(0, s - 1)))}
          onSiguiente={() => setEventoSel((s) => (s == null ? s : Math.min(eventos.length - 1, s + 1)))}
        />
      )}

      {/* Vista ampliada */}
      {modalAbierto && <ModalMapa filtrosIniciales={filtros} catalogo={catalogo ?? []} onCerrar={() => setModalAbierto(false)} />}
    </div>
  );
}
