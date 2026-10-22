import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@/app/auth/AuthContext";
import { SOURCE_NAME } from "@/config/fuente";
import { fmtTimeUTC5 } from "@/lib/format";
import { useMeta } from "@/lib/useMeta";
import { copyText } from "@/lib/export";
import { useFuentesURL } from "./hooks/useFuentesURL";
import { useFuentesMeta } from "./hooks/useFuentesMeta";
import { useEjecuciones } from "./hooks/useEjecuciones";
import { useEjecucionesVentana } from "./hooks/useEjecucionesVentana";
import { useLogs } from "./hooks/useLogs";
import type { SeccionFuente } from "./kpis";
import {
  PARTES_EXPORT,
  cargarContextoExport,
  cargarProcedencia,
  exportarPartes,
  guardarConfiguracion,
  sincronizarAhora,
  textoPartes,
  type FormatoExport,
  type ParteExportId,
} from "./services/fuentes.service";
import AvisoFuente from "./components/AvisoFuente";
import TarjetasFuente from "./components/TarjetasFuente";
import FichaConector from "./components/FichaConector";
import PestanasFuente from "./components/PestanasFuente";
import TablaEjecuciones from "./components/TablaEjecuciones";
import TablaCalidad from "./components/TablaCalidad";
import TablaLogs from "./components/TablaLogs";
import FormularioConfiguracion from "./components/FormularioConfiguracion";
import DetalleEjecucionModal from "./components/DetalleEjecucionModal";
import ModalSincronizar from "./components/ModalSincronizar";
import SeccionModal from "./components/SeccionModal";
import ModalExportar from "./components/ModalExportar";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { IconAlertTriangle, IconClock, IconDownload, IconZap } from "@/components/ui/Icons";

const TODAS: ParteExportId[] = PARTES_EXPORT.map((p) => p.id);

export default function FuentesDatosPage() {
  const { canAccess } = useAuth();
  const {
    tab,
    ejec,
    logs,
    pagina,
    tamano,
    chips,
    setTab,
    setFiltrosEjec,
    setFiltrosLogs,
    quitarChip,
    irAPagina,
    setTamano,
    limpiar,
  } = useFuentesURL();

  // Sube al cerrar la sincronización manual: recarga indicadores, ejecuciones y registros.
  const [recarga, setRecarga] = useState(0);
  const { cargando: cargandoMeta, error: errorMeta, meta, reintentar } = useFuentesMeta(recarga);
  const { datos: datosEjec, cargando: cargandoEjec } = useEjecuciones(ejec, pagina, tamano, recarga);
  const ventana = useEjecucionesVentana(ejec, recarga);
  const { datos: datosLogs, cargando: cargandoLogs } = useLogs(logs, pagina, tamano, recarga);

  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [seccion, setSeccion] = useState<SeccionFuente | null>(null);
  const [exportarIniciales, setExportarIniciales] = useState<ParteExportId[] | null>(null);
  const [sincronizar, setSincronizar] = useState(false);
  const [procedencia, setProcedencia] = useState<{ fuente: string; ventana: string } | null>(null);
  const metaIso = useMeta();

  useEffect(() => setSeleccionId(null), [ejec, pagina, tamano, tab]);

  useEffect(() => {
    let vigente = true;
    cargarProcedencia()
      .then((p) => {
        if (vigente) setProcedencia(p);
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [recarga]);

  const actTime = fmtTimeUTC5(metaIso);

  const puedeExportar = canAccess("fuentes");
  const puedeSincronizar = canAccess("fuentes_sincronizar");
  const puedeConfigurar = canAccess("fuentes_configurar");

  const abrirDetalle = (id: string) => {
    setSeccion(null);
    setSeleccionId(id);
  };

  const abrirExportar = (ids: ParteExportId[]) => {
    setSeccion(null);
    setExportarIniciales(ids);
  };

  const idxSel = seleccionId ? ventana.findIndex((e) => e.id === seleccionId) : -1;
  const ejecucion = idxSel >= 0 ? ventana[idxSel] : null;

  const conteos = {
    ejecuciones: datosEjec?.total,
    calidad: meta?.calidad.length,
    registro: datosLogs?.total,
  };

  return (
    <div>
      {/* Encabezado */}
      <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-xs text-content-muted">
        <Link to="/" className="transition-colors hover:text-content">
          Inicio
        </Link>
        <span aria-hidden="true">/</span>
        <span>Datos</span>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-content-secondary">Fuentes de datos</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Fuentes de datos</h1>
          <p className="mt-0.5 text-xs text-content-muted">
            Estado, ejecuciones, calidad y configuración del conector con el proveedor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-content-muted">
            <IconClock size={14} />
            Actualizado: <b className="font-medium text-content-secondary">{actTime}</b> (UTC-5)
          </span>
          <button
            type="button"
            onClick={() => abrirExportar(TODAS)}
            disabled={!puedeExportar}
            title={puedeExportar ? "Exportar por partes en CSV o Excel" : "Tu rol no permite exportar datos"}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconDownload size={14} />
            Exportar
          </button>
          {puedeSincronizar && (
            <button
              type="button"
              onClick={() => setSincronizar(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500"
            >
              <IconZap size={14} />
              Sincronizar ahora
            </button>
          )}
        </div>
      </div>

      {/* Aviso fijo */}
      <AvisoFuente />

      {errorMeta ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <IconAlertTriangle size={26} className="mx-auto text-content-muted" />
          <p className="mt-2 text-sm font-medium text-content">No se pudo cargar la fuente</p>
          <p className="mt-0.5 text-xs text-content-muted">{errorMeta}</p>
          <button
            type="button"
            onClick={reintentar}
            className="mt-3 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-tertiary"
          >
            Reintentar
          </button>
        </div>
      ) : cargandoMeta && !meta ? (
        <>
          <div className="mb-3 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <Skeleton className="mb-3 h-40 w-full" />
        </>
      ) : meta ? (
        <>
          {/* KPIs */}
          <TarjetasFuente resumen={meta.resumen} ventana={ventana} onAbrir={setSeccion} />

          {/* Ficha del conector */}
          <FichaConector ficha={meta.ficha} onExpandir={() => setSeccion("conector")} />

          {/* Pestañas */}
          <PestanasFuente tab={tab} onCambiar={setTab} conteos={conteos} onExpandirActiva={setSeccion} />

          {/* Chips de filtros activos */}
          {chips.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <span
                  key={c.clave}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-content-secondary"
                >
                  {c.etiqueta}
                  <button type="button" onClick={() => quitarChip(c.clave)} className="text-content-muted hover:text-content" aria-label={`Quitar filtro ${c.etiqueta}`}>
                    ×
                  </button>
                </span>
              ))}
              <button type="button" onClick={limpiar} className="text-[11px] text-content-muted hover:text-content">
                Limpiar
              </button>
            </div>
          )}

          {/* Contenido de la pestaña */}
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "ejecuciones" && (
              <TablaEjecuciones
                datos={datosEjec}
                ventana={ventana}
                cargando={cargandoEjec}
                ejec={ejec}
                tamano={tamano}
                onFiltros={setFiltrosEjec}
                onAbrir={abrirDetalle}
                onPunto={abrirDetalle}
                onPagina={irAPagina}
                onTamano={setTamano}
                onExpandirGrafico={() => setSeccion("latencia")}
                onExpandirTabla={() => setSeccion("ejecuciones")}
              />
            )}
            {tab === "calidad" && (
              <TablaCalidad filas={meta.calidad} onExpandir={() => setSeccion("calidad")} onAbrirCampo={() => setSeccion("calidad")} />
            )}
            {tab === "registro" && (
              <TablaLogs
                datos={datosLogs}
                cargando={cargandoLogs}
                logs={logs}
                tamano={tamano}
                onFiltros={setFiltrosLogs}
                onPagina={irAPagina}
                onTamano={setTamano}
                onExpandir={() => setSeccion("registro")}
              />
            )}
            {tab === "configuracion" && (
              <FormularioConfiguracion
                config={meta.configuracion}
                puedeEditar={puedeConfigurar}
                onGuardar={guardarConfiguracion}
                onExpandir={() => setSeccion("configuracion")}
              />
            )}
          </div>

          {/* Pie */}
          <p className="mt-3 text-[11px] text-content-muted">
            Fuente: {SOURCE_NAME} · Conector único · Ventana: {procedencia?.ventana ?? "—"} (UTC-5) · Actualizado: {actTime} (UTC-5)
          </p>
        </>
      ) : null}

      {/* Vista ampliada de una sección */}
      {seccion && meta && (
        <SeccionModal
          seccion={seccion}
          resumen={meta.resumen}
          ficha={meta.ficha}
          calidad={meta.calidad}
          configuracion={meta.configuracion}
          ejec={ejec}
          logs={logs}
          onExportar={abrirExportar}
          onCerrar={() => setSeccion(null)}
        />
      )}

      {/* Detalle de ejecución */}
      {ejecucion && (
        <DetalleEjecucionModal
          ejecucion={ejecucion}
          posicion={idxSel + 1}
          total={ventana.length}
          hayAnterior={idxSel > 0}
          haySiguiente={idxSel < ventana.length - 1}
          onCerrar={() => setSeleccionId(null)}
          onAnterior={() => setSeleccionId(ventana[Math.max(0, idxSel - 1)].id)}
          onSiguiente={() => setSeleccionId(ventana[Math.min(ventana.length - 1, idxSel + 1)].id)}
        />
      )}

      {/* Exportación por partes */}
      {exportarIniciales && (
        <ModalExportar
          iniciales={exportarIniciales}
          onCerrar={() => setExportarIniciales(null)}
          onDescargar={async (ids: ParteExportId[], formato: FormatoExport) => {
            const ctx = await cargarContextoExport(ejec, logs);
            exportarPartes(ids, formato, ctx);
            setExportarIniciales(null);
          }}
          onCopiar={async (ids: ParteExportId[]) => {
            const ctx = await cargarContextoExport(ejec, logs);
            return copyText(textoPartes(ids, ctx));
          }}
        />
      )}

      {/* Sincronización manual */}
      {sincronizar && (
        <ModalSincronizar
          onCerrar={() => {
            setSincronizar(false);
            setRecarga((r) => r + 1);
          }}
          onSincronizar={sincronizarAhora}
        />
      )}
    </div>
  );
}
