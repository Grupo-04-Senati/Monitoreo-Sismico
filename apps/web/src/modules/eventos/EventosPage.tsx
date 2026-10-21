import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@/app/auth/AuthContext";
import { SOURCE_NAME } from "@/config/fuente";
import { DATA_RANGE_LABEL } from "@/lib/ancla";
import { fmtTimeUTC5 } from "@/lib/format";
import { useMeta } from "@/lib/useMeta";
import { useFiltrosURL } from "./hooks/useFiltrosURL";
import { useEventos } from "./hooks/useEventos";
import { chipsDesdeFiltros, ORDEN_POR_DEFECTO, resumenFiltros } from "./schemas/filtros.schema";
import {
  descargarEventos,
  FILTROS_CATALOGO,
  listarSeleccion,
  nombreExport,
  obtenerProcedencia,
  type AlcanceExport,
  type FormatoExport,
} from "./services/eventos.service";
import { DATA_MAX_DAY } from "@/lib/ancla";
import type { EventoSismico, SeccionResumen } from "./types";
import AvisoObservacion from "./components/AvisoObservacion";
import FranjaProcedencia from "./components/FranjaProcedencia";
import TarjetasResumen from "./components/TarjetasResumen";
import FiltrosEventos from "./components/FiltrosEventos";
import ChipsFiltros from "./components/ChipsFiltros";
import SelectorColumnas from "./components/SelectorColumnas";
import TablaEventos from "./components/TablaEventos";
import TablaSkeleton from "./components/TablaSkeleton";
import EstadoVacio from "./components/EstadoVacio";
import Glosario from "./components/Glosario";
import DetalleEventoModal from "./components/DetalleEventoModal";
import ModalExportar from "./components/ModalExportar";
import ModalResumen from "./components/ModalResumen";
import { IconAlertTriangle, IconClock, IconDownload, IconEvents } from "@/components/ui/Icons";

export default function EventosPage() {
  const { canAccess } = useAuth();
  const {
    filtros,
    orden,
    pagina,
    tamano,
    columnas,
    errores,
    hayFiltros,
    setFiltros,
    quitarChip,
    ordenarPor,
    irAPagina,
    setTamano,
    alternarColumna,
    limpiar,
  } = useFiltrosURL();

  const { cargando, error, datos, resumen, reintentar } = useEventos(filtros, orden, pagina, tamano);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [exportar, setExportar] = useState(false);
  const [resumenAbierto, setResumenAbierto] = useState<{ seccion: SeccionResumen; eventos: EventoSismico[] } | null>(null);

  /* Al cambiar filtros/orden/página se cierra el detalle abierto. */
  useEffect(() => setSeleccion(null), [filtros, orden, pagina, tamano]);

  const procedencia = useMemo(() => obtenerProcedencia(), []);
  const chips = useMemo(() => chipsDesdeFiltros(filtros), [filtros]);
  const metaIso = useMeta();
  const actTime = fmtTimeUTC5(metaIso);
  const filas = datos?.filas ?? [];
  const total = datos?.total ?? 0;

  /* El bloqueo por rol es de interfaz; la API real debe validarlo también. */
  const puedeExportar = canAccess("eventos_exportar");
  const tituloExportar = !puedeExportar
    ? "Tu rol no permite exportar datos"
    : total === 0
      ? "No hay eventos que exportar"
      : "Exportar eventos (filtrados o todo el catálogo)";

  const [totalCatalogo, setTotalCatalogo] = useState(0);
  const fechaArchivo = filtros.periodo === "custom" && filtros.hasta ? filtros.hasta : DATA_MAX_DAY;

  useEffect(() => {
    listarSeleccion(FILTROS_CATALOGO, ORDEN_POR_DEFECTO).then((filas) => setTotalCatalogo(filas.length));
  }, []);

  /* Toda la selección filtrada (no solo la página) para los modales de resumen. */
  const abrirResumen = async (seccion: SeccionResumen) => {
    const eventos = await listarSeleccion(filtros, orden);
    setResumenAbierto({ seccion, eventos });
  };

  const descargar = async (alcance: AlcanceExport, formato: FormatoExport) => {
    const eventos = await listarSeleccion(alcance === "filtrados" ? filtros : FILTROS_CATALOGO, orden);
    descargarEventos(eventos, formato, nombreExport(alcance, fechaArchivo));
    setExportar(false);
  };

  const evento = seleccion != null ? filas[seleccion] ?? null : null;
  const posicion = datos && seleccion != null ? (datos.pagina - 1) * datos.tamano + seleccion + 1 : 0;

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
        <span className="font-medium text-content-secondary">Eventos sísmicos</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Eventos sísmicos</h1>
          <p className="mt-0.5 text-xs text-content-muted">
            Catálogo del periodo con filtros, orden, detalle y exportación.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-content-muted">
            <IconClock size={14} />
            Actualizado: <b className="font-medium text-content-secondary">{actTime}</b> (UTC-5)
          </span>
          <button
            type="button"
            onClick={() => setExportar(true)}
            disabled={!puedeExportar || total === 0}
            title={tituloExportar}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconDownload size={14} />
            Exportar
          </button>
        </div>
      </div>

      {/* Aviso fijo */}
      <AvisoObservacion />

      {/* Franja de procedencia */}
      <FranjaProcedencia procedencia={procedencia} />

      {/* Resumen de la selección */}
      <TarjetasResumen resumen={resumen} onAbrir={abrirResumen} />

      {/* Filtros */}
      <FiltrosEventos
        filtros={filtros}
        errores={errores}
        hayFiltros={hayFiltros}
        onCambiar={setFiltros}
        onLimpiar={limpiar}
      />

      <ChipsFiltros chips={chips} onQuitar={quitarChip} onLimpiar={limpiar} />

      {/* Columnas opcionales (solo cuando hay filas) */}
      {!error && datos && datos.total > 0 && (
        <SelectorColumnas columnas={columnas} onAlternar={alternarColumna} />
      )}

      {/* Contenido */}
      {error ? (
        <EstadoVacio
          tono="error"
          icono={<IconAlertTriangle size={26} />}
          titulo="No se pudieron cargar los eventos"
          descripcion={error}
          accion={
            <button
              type="button"
              onClick={reintentar}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-tertiary"
            >
              Reintentar
            </button>
          }
        />
      ) : cargando && !datos ? (
        <TablaSkeleton filas={tamano} />
      ) : datos && datos.total === 0 ? (
        <EstadoVacio
          icono={<IconEvents size={26} />}
          titulo="Sin eventos para estos filtros"
          descripcion="Ajusta el periodo, la región, la magnitud o el estado, o limpia los filtros para ver todo el catálogo."
          accion={
            hayFiltros ? (
              <button
                type="button"
                onClick={limpiar}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-tertiary"
              >
                Limpiar filtros
              </button>
            ) : undefined
          }
        />
      ) : datos ? (
        <TablaEventos
          filas={datos.filas}
          total={datos.total}
          pagina={datos.pagina}
          tamano={datos.tamano}
          totalPaginas={datos.totalPaginas}
          orden={orden}
          columnas={columnas}
          cargando={cargando}
          onOrdenar={ordenarPor}
          onAbrir={setSeleccion}
          onPagina={irAPagina}
          onTamano={setTamano}
        />
      ) : null}

      {/* Pie */}
      <p className="mt-3 text-[11px] text-content-muted">
        Fuente: {SOURCE_NAME} · {resumenFiltros(filtros)} · n={total.toLocaleString("es-PE")} · Catálogo:{" "}
        {DATA_RANGE_LABEL} · Actualizado: {actTime} (UTC-5)
      </p>

      {/* Glosario */}
      <Glosario />

      {/* Detalle */}
      {evento && datos && (
        <DetalleEventoModal
          evento={evento}
          posicion={posicion}
          total={datos.total}
          hayAnterior={seleccion != null && seleccion > 0}
          haySiguiente={seleccion != null && seleccion < filas.length - 1}
          onCerrar={() => setSeleccion(null)}
          onAnterior={() => setSeleccion((s) => (s == null ? s : Math.max(0, s - 1)))}
          onSiguiente={() => setSeleccion((s) => (s == null ? s : Math.min(filas.length - 1, s + 1)))}
        />
      )}

      {/* Resumen de una tarjeta */}
      {resumenAbierto && (
        <ModalResumen
          seccion={resumenAbierto.seccion}
          eventos={resumenAbierto.eventos}
          resumen={resumen}
          onCerrar={() => setResumenAbierto(null)}
        />
      )}

      {/* Exportación */}
      {exportar && (
        <ModalExportar
          totalFiltrados={total}
          totalCatalogo={totalCatalogo}
          onCerrar={() => setExportar(false)}
          onDescargar={descargar}
        />
      )}
    </div>
  );
}
