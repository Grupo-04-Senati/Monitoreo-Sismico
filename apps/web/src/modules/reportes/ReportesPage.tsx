import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/auth/AuthContext";
import { NOW } from "@/lib/ancla";
import { REGION_OPTIONS } from "@/lib/catalogo";
import { fmtTimeUTC5 } from "@/lib/format";
import { useMeta } from "@/lib/useMeta";
import { IconCheck, IconClock, IconInfo } from "@/components/ui/Icons";
import { useReportesURL } from "./hooks/useReportesURL";
import type { ConteoTipoEstadoReporte, EstadoReporte, ParametrosReporte, Reporte, ResumenReportes, PaginaReportes } from "./types";
import type { IdKpiReporte } from "./kpis";
import { KPIS } from "./kpis";
import {
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO,
  UMBRAL_POR_EXPIRAR_HORAS,
  type ZonaOption,
} from "./schemas/reportes.schema";
import {
  conteosTipoEstado,
  crearReporte,
  descargarReporte,
  listarReportes,
  listarSinPaginar,
  obtenerReporte,
  opcionesSolicitantes,
  resumenReportes,
} from "./services/reportes.service";
import AvisoReportes from "./components/AvisoReportes";
import IndicadoresReportes from "./components/IndicadoresReportes";
import GraficoReportes from "./components/GraficoReportes";
import NuevoReporte from "./components/NuevoReporte";
import FiltrosReportes from "./components/FiltrosReportes";
import TablaReportes from "./components/TablaReportes";
import DetalleReporteModal from "./components/DetalleReporteModal";
import ModalListaReportes from "./components/ModalListaReportes";

interface Lista {
  titulo: string;
  descripcion?: string;
  reportes: Reporte[];
}

const ZONAS: ZonaOption[] = REGION_OPTIONS.map((r) => ({ slug: r.slug, name: r.name }));

export default function ReportesPage() {
  const { user, canAccess } = useAuth();
  const puedeGenerar = canAccess("reportes_generar");
  const puedePdf = canAccess("reportes_pdf");
  const usuarioId = user?.id ?? "";

  const { filtros, pagina, tamano, chips, setFiltros, quitarChip, irAPagina, setTamano, limpiar } = useReportesURL(
    user?.fullName ?? "",
  );

  const [resumen, setResumen] = useState<ResumenReportes | null>(null);
  const [conteos, setConteos] = useState<ConteoTipoEstadoReporte[] | null>(null);
  const [datos, setDatos] = useState<PaginaReportes | null>(null);
  const [cargando, setCargando] = useState(true);
  const [nonce, setNonce] = useState(0);

  const [reporteSel, setReporteSel] = useState<Reporte | null>(null);
  const [lista, setLista] = useState<Lista | null>(null);
  const [creando, setCreando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [solicitantes, setSolicitantes] = useState<{ value: string; label: string }[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    opcionesSolicitantes()
      .then((o) => {
        if (vivo) setSolicitantes(o);
      })
      .catch(() => {
        if (vivo) setSolicitantes([{ value: "", label: "Todas las personas" }, { value: "mios", label: "Mis informes" }]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  /* Resumen y conteos (refrescan al cambiar el nonce). */
  useEffect(() => {
    let vivo = true;
    setError(false);
    Promise.all([resumenReportes(), conteosTipoEstado()])
      .then(([r, c]) => {
        if (vivo) {
          setResumen(r);
          setConteos(c);
        }
      })
      .catch(() => {
        if (vivo) setError(true);
      });
    return () => {
      vivo = false;
    };
  }, [nonce]);

  /* Lista paginada. */
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(false);
    listarReportes(filtros, pagina, tamano, usuarioId)
      .then((d) => {
        if (vivo) {
          setDatos(d);
          setCargando(false);
        }
      })
      .catch(() => {
        if (vivo) {
          setCargando(false);
          setError(true);
        }
      });
    return () => {
      vivo = false;
    };
  }, [filtros, pagina, tamano, usuarioId, nonce]);

  /* Reconsulta mientras haya informes en proceso. */
  useEffect(() => {
    if (!resumen || resumen.enProceso === 0) return;
    const id = setInterval(() => setNonce((n) => n + 1), 1500);
    return () => clearInterval(id);
  }, [resumen]);

  const refrescar = useCallback(() => setNonce((n) => n + 1), []);

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(null), 3400);
  }, []);

  const crear = useCallback(
    async (parametros: ParametrosReporte) => {
      if (!user) return;
      setCreando(true);
      await crearReporte(parametros, user);
      setCreando(false);
      mostrarAviso("Informe solicitado · se genera en segundo plano y queda registrado en Auditoría");
      refrescar();
    },
    [user, mostrarAviso, refrescar],
  );

  const abrirDetalle = useCallback(async (r: Reporte) => {
    const actualizado = await obtenerReporte(r.id);
    setLista(null);
    setReporteSel(actualizado ?? r);
  }, []);

  const descargar = useCallback(
    async (r: Reporte) => {
      const res = await descargarReporte(r);
      if (res === "descargado") mostrarAviso(`Informe descargado · ${r.nombre}`);
      else if (res === "copiado") mostrarAviso("Descarga no disponible; el contenido se copió al portapapeles");
      else if (res === "expirado") {
        mostrarAviso("El enlace expiró: solicita el informe de nuevo");
        refrescar();
      } else if (res === "no-listo") mostrarAviso("El informe todavía no está listo");
      else mostrarAviso("No se pudo descargar el informe");
    },
    [mostrarAviso, refrescar],
  );

  const todos = useCallback(() => listarSinPaginar({ tipo: "", estado: "", solicitante: "" }, usuarioId), [usuarioId]);

  const abrirKpi = useCallback(
    async (id: IdKpiReporte) => {
      const def = KPIS.find((k) => k.id === id);
      const base = await todos();
      const limite = NOW.getTime() + UMBRAL_POR_EXPIRAR_HORAS * 3600_000;
      const reportes =
        id === "total"
          ? base
          : id === "generados"
            ? base.filter((r) => r.estado === "listo")
            : id === "enProceso"
              ? base.filter((r) => r.estado === "pendiente" || r.estado === "en_proceso")
              : id === "fallidos"
                ? base.filter((r) => r.estado === "fallido")
                : base.filter((r) => r.estado === "listo" && r.expiraUtc != null && Date.parse(r.expiraUtc) <= limite);
      setReporteSel(null);
      setLista({ titulo: def?.etiqueta ?? "Informes", descripcion: def?.descripcion, reportes });
    },
    [todos],
  );

  const abrirSegmento = useCallback(
    async (tipo: ConteoTipoEstadoReporte["tipo"], estado: EstadoReporte) => {
      const reportes = await listarSinPaginar({ tipo, estado, solicitante: "" }, usuarioId);
      setReporteSel(null);
      setLista({
        titulo: `${ETIQUETA_TIPO[tipo]} · ${ETIQUETA_ESTADO[estado]}`,
        reportes,
      });
    },
    [usuarioId],
  );

  const metaIso = useMeta();
  const actTime = fmtTimeUTC5(metaIso);

  return (
    <div>
      {/* Encabezado */}
      <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-xs text-content-muted">
        <Link to="/" className="transition-colors hover:text-content">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-content-secondary">Reportes</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Reportes</h1>
          <p className="mt-0.5 text-xs text-content-muted">
            Genera informes reproducibles de eventos, calidad y fuentes. El enlace de descarga expira.
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-content-muted">
          <IconClock size={14} />
          Actualizado: <b className="font-medium text-content-secondary">{actTime}</b> (UTC-5)
        </span>
      </div>

      <AvisoReportes />

      {error && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2.5 text-xs text-content-secondary"
        >
          <IconInfo size={14} className="shrink-0 text-rose-600" />
          <span>No se pudo conectar con la API de reportes.</span>
          <button
            type="button"
            onClick={refrescar}
            className="ml-auto rounded-md border border-border px-2.5 py-1 font-medium text-content transition-colors hover:bg-surface-secondary"
          >
            Reintentar
          </button>
        </div>
      )}

      {resumen ? (
        <IndicadoresReportes resumen={resumen} onAbrir={abrirKpi} />
      ) : (
        <div className="mb-3 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      )}

      <div className="mb-3">
        {conteos ? (
          <GraficoReportes conteos={conteos} onSegmento={abrirSegmento} />
        ) : (
          <div className="h-72 animate-pulse rounded-lg border border-border bg-surface" />
        )}
      </div>

      <div className="mb-3">
        <NuevoReporte
          puedeGenerar={puedeGenerar}
          puedePdf={puedePdf}
          zonas={ZONAS}
          creando={creando}
          onCrear={crear}
        />
      </div>

      <FiltrosReportes
        filtros={filtros}
        tamano={tamano}
        solicitantes={solicitantes}
        onFiltros={setFiltros}
        onTamano={setTamano}
        onLimpiar={limpiar}
      />

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

      <TablaReportes datos={datos} cargando={cargando} onAbrir={abrirDetalle} onPagina={irAPagina} onDescargar={descargar} />

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-content-muted">
        <IconInfo size={12} />
        Reproductibles por filtros y fecha de corte · Acceso al archivo: solicitante o Administrador · n ={" "}
        {resumen ? resumen.total : "—"} informes
      </p>

      {/* Detalle */}
      {reporteSel && (
        <DetalleReporteModal
          reporte={reporteSel}
          zonas={ZONAS}
          onDescargar={descargar}
          onCerrar={() => setReporteSel(null)}
        />
      )}

      {/* Lista de un indicador o segmento */}
      {lista && (
        <ModalListaReportes
          titulo={lista.titulo}
          descripcion={lista.descripcion}
          reportes={lista.reportes}
          onAbrir={abrirDetalle}
          onCerrar={() => setLista(null)}
        />
      )}

      {/* Aviso de acción */}
      {aviso && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-xs text-content shadow-lg"
        >
          <IconCheck size={14} className="text-accent-600" />
          {aviso}
        </div>
      )}
    </div>
  );
}
