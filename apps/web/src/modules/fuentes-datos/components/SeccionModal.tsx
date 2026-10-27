import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { CalidadCampo, ConfiguracionFuente, ConectorFuente, FiltrosEjecuciones, FiltrosLogs, OrdenLista, ResumenFuente } from "../types";
import type { SeccionFuente } from "../kpis";
import type { ContextoExport, ParteExportId } from "../services/fuentes.service";
import { KPIS, detalleUltimoExito } from "../kpis";
import { cargarContextoExport, resumenPorHora, textoPartes } from "../services/fuentes.service";
import {
  COLOR_EJECUCION,
  COLOR_NIVEL,
  ESTADOS_EJECUCION,
  ETIQUETA_EJECUCION,
  ETIQUETA_NIVEL,
  NIVELES_LOG,
  ORDENES,
  PERIODOS,
  TAMANO_POR_DEFECTO,
} from "../schemas/fuentes.schema";
import { fmtDateUTC5, fmtDateTimeUTC5, fmtTimeUTC5 } from "@/lib/format";
import ExpandModal from "@/components/ui/ExpandModal";
import DataTable from "@/components/ui/DataTable";
import StatusBadge from "@/components/ui/StatusBadge";
import BarChart from "@/components/charts/BarChart";
import AreaChart from "@/components/charts/AreaChart";
import HBarChart from "@/components/charts/HBarChart";
import GraficoLatencia, { type PuntoLatencia } from "./GraficoLatencia";
import Paginador from "./Paginador";
import SelectorFilas from "./SelectorFilas";
import DetalleEjecucion from "./DetalleEjecucion";
import { IconClose, IconDownload, IconInfo, IconSearch } from "@/components/ui/Icons";

const selectCls =
  "rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none";

const inputCls =
  "w-full rounded-md border border-border bg-surface py-1.5 pl-7 pr-2 text-xs text-content focus:border-accent-500 focus:outline-none sm:w-56";

const TODAS_PARTES: ParteExportId[] = ["resumen", "conector", "ejecuciones", "hora", "calidad", "registro", "configuracion"];

interface SeccionModalProps {
  seccion: SeccionFuente;
  resumen: ResumenFuente | null;
  ficha: ConectorFuente | null;
  calidad: CalidadCampo[];
  configuracion: ConfiguracionFuente | null;
  /** Filtros de partida (los de la página). */
  ejec: FiltrosEjecuciones;
  logs: FiltrosLogs;
  onExportar: (ids: ParteExportId[]) => void;
  onCerrar: () => void;
}

/** Parte(s) de exportación asociadas a cada sección. */
export function partesDeSeccion(seccion: SeccionFuente): ParteExportId[] {
  if (seccion.startsWith("kpi-")) return ["resumen", "hora"];
  switch (seccion) {
    case "conector":
      return ["conector"];
    case "latencia":
      return ["ejecuciones", "hora"];
    case "ejecuciones":
      return ["ejecuciones"];
    case "calidad":
      return ["calidad"];
    case "registro":
      return ["registro"];
    case "configuracion":
      return ["configuracion"];
    default:
      return [];
  }
}

const TITULOS: Record<string, string> = {
  conector: "Ficha del conector",
  latencia: "Latencia por ejecución",
  ejecuciones: "Ejecuciones de la ingesta",
  calidad: "Calidad de los datos",
  registro: "Registro de la ingesta",
  configuracion: "Configuración del conector",
};

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1.5 last:border-0">
      <dt className="shrink-0 text-[11px] text-content-muted">{etiqueta}</dt>
      <dd className="text-right text-xs font-medium text-content-secondary">{children}</dd>
    </div>
  );
}

function Dato({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary px-3 py-2.5">
      <span className="block text-[10px] uppercase tracking-[0.04em] text-content-muted">{etiqueta}</span>
      <b className="mt-0.5 block text-[15px] font-semibold leading-snug text-content">{valor}</b>
      {detalle && <span className="mt-0.5 block text-[11px] text-content-muted">{detalle}</span>}
    </div>
  );
}

function Barra({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3.5">{children}</div>
  );
}

function CampoSelect({
  label,
  value,
  onChange,
  opciones,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opciones: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-content-secondary">{label}</span>
      <select value={value} onChange={(ev) => onChange(ev.target.value)} className={selectCls} aria-label={label}>
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Buscador({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-content-secondary">Buscar</span>
      <span className="relative">
        <IconSearch size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-content-muted" />
        <input value={value} onChange={(ev) => onChange(ev.target.value)} placeholder={placeholder} className={inputCls} />
      </span>
    </label>
  );
}

function Reiniciar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-[11px] text-content-muted transition-colors hover:text-content">
      Restablecer
    </button>
  );
}

/** Estadísticas de latencia de la ventana (excluye fallidas). */
function estadisticasLatencia(ventana: { estado: string; latenciaMs: number }[]) {
  const vals = ventana.filter((e) => e.estado !== "fallida").map((e) => e.latenciaMs).sort((a, b) => a - b);
  if (!vals.length) return { min: 0, mediana: 0, p95: 0, max: 0, media: 0, n: 0 };
  const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * (vals.length - 1)))];
  const media = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  return { min: vals[0], mediana: Math.round(q(0.5)), p95: Math.round(q(0.95)), max: vals[vals.length - 1], media, n: vals.length };
}

/** Vista ampliada (pantalla completa) de una sección, con sus propios filtros. */
export default function SeccionModal({
  seccion,
  resumen,
  ficha,
  calidad,
  configuracion,
  ejec,
  logs,
  onExportar,
  onCerrar,
}: SeccionModalProps) {
  const [periodo, setPeriodo] = useState(ejec.periodo);
  const [estado, setEstado] = useState<FiltrosEjecuciones["estado"]>(ejec.estado);
  const [nivel, setNivel] = useState<FiltrosLogs["nivel"]>(logs.nivel);
  const [orden, setOrden] = useState<OrdenLista>(ejec.orden);
  const [busca, setBusca] = useState("");
  const [campoSel, setCampoSel] = useState<CalidadCampo | null>(null);
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(TAMANO_POR_DEFECTO);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const filaRef = useRef<HTMLDivElement>(null);
  const [anchoDetalle, setAnchoDetalle] = useState(360);
  const [arrastrando, setArrastrando] = useState(false);

  /* Cada sección abierta parte de los filtros de la página. */
  useEffect(() => {
    setPeriodo(ejec.periodo);
    setEstado(ejec.estado);
    setNivel(logs.nivel);
    setOrden(ejec.orden);
    setBusca("");
    setCampoSel(null);
    setPagina(1);
    setDetalleId(null);
  }, [seccion, ejec.periodo, ejec.estado, ejec.orden, logs.nivel]);

  /* Al cambiar filtros, orden o tamaño se vuelve a la primera página. */
  useEffect(() => {
    setPagina(1);
  }, [periodo, estado, nivel, orden, busca, tamano]);

  /* Al cambiar filtros o búsqueda se cierra el panel de detalle. */
  useEffect(() => {
    setDetalleId(null);
  }, [periodo, estado, nivel, orden, busca]);

  /* Datos propios del modal (independientes de la página). */
  const ejecLocal: FiltrosEjecuciones = { periodo, estado, orden };
  const logsLocal: FiltrosLogs = { nivel, orden };
  const [datos, setDatos] = useState<ContextoExport | null>(null);
  useEffect(() => {
    let vigente = true;
    setDatos(null);
    cargarContextoExport(ejecLocal, logsLocal)
      .then((d) => {
        if (vigente) setDatos(d);
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, estado, orden, nivel]);
  const ventana = datos?.ventana ?? [];
  const registro = datos?.registro ?? [];
  const horaResumen = useMemo(() => resumenPorHora(ventana), [ventana]);
  const meta = {
    resumen: resumen ?? { estadoConector: "operativo" as const, estadoConectorDetalle: "", ultimoExitoUtc: "", latenciaMediaMs: 0, tasaExitoPct: 0, registrosInsertados: 0, registrosCorregidos: 0, duplicadosOmitidos: 0 },
    ficha: ficha ?? { nombre: "", organizacion: "", tipo: "", urlApi: "", frecuencia: "", ultimaEjecucionUtc: "", ultimoExitoUtc: "", latenciaMs: 0, limitesUso: null, licencia: null, contacto: null, credencialRef: "" },
    calidad,
    configuracion: configuracion ?? { frecuenciaMin: 0, urlApi: "", licencia: "", contacto: "", limitesUso: "", reintentos: 0, timeoutSeg: 0, ingestaIdempotente: true, notificarErrores: true },
  };
  const ctx: ContextoExport = datos ?? { filtrosEjec: ejecLocal, filtrosLogs: logsLocal, meta, ventana: [], registro: [] };

  const buscar = busca.trim().toLowerCase();
  const titulo = seccion.startsWith("kpi-") ? KPIS[Number(seccion.slice(4))].etiqueta : TITULOS[seccion];
  const partes = partesDeSeccion(seccion);

  /* Detalle de la ejecución mostrado en el panel lateral del propio modal. */
  const idxDetalle = detalleId ? ventana.findIndex((e) => e.id === detalleId) : -1;
  const ejecucionDetalle = idxDetalle >= 0 ? ventana[idxDetalle] : null;

  /** Trocea una lista según la página y el tamaño elegidos en el modal. */
  const paginar = <T,>(lista: T[]) => {
    const totalPaginas = Math.max(1, Math.ceil(lista.length / tamano));
    const actual = Math.min(pagina, totalPaginas);
    const inicio = (actual - 1) * tamano;
    return { visibles: lista.slice(inicio, inicio + tamano), total: lista.length, pagina: actual, totalPaginas };
  };

  const filtrarRestablecer = () => {
    setPeriodo(ejec.periodo);
    setEstado(ejec.estado);
    setNivel(logs.nivel);
    setOrden(ejec.orden);
    setBusca("");
    setPagina(1);
    setDetalleId(null);
  };

  const filtroPeriodo = (
    <CampoSelect label="Periodo" value={periodo} onChange={setPeriodo} opciones={PERIODOS.map((p) => ({ value: p.value, label: p.label }))} />
  );
  const filtroEstado = (
    <CampoSelect label="Estado" value={estado} onChange={(v) => setEstado(v as FiltrosEjecuciones["estado"])} opciones={ESTADOS_EJECUCION} />
  );
  const filtroOrden = (
    <CampoSelect label="Orden" value={orden} onChange={(v) => setOrden(v as OrdenLista)} opciones={ORDENES} />
  );

  /* Pie de paginación (filas por página 5/10/25 y Anterior/Siguiente). */
  const paginacion = (p: ReturnType<typeof paginar>, unidad: string) => (
    <Paginador total={p.total} pagina={p.pagina} tamano={tamano} totalPaginas={p.totalPaginas} unidad={unidad} onPagina={setPagina} />
  );

  /* Selector de filas por página, junto al resto de filtros. */
  const filtroFilas = <SelectorFilas tamano={tamano} onTamano={setTamano} />;

  const pie = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(textoPartes(partes, ctx)).catch(() => undefined)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-tertiary"
      >
        Copiar esta sección
      </button>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => onExportar(TODAS_PARTES)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-tertiary"
        >
          <IconDownload size={13} />
          Exportar todo
        </button>
        <button
          type="button"
          onClick={() => onExportar(partes)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500"
        >
          <IconDownload size={13} />
          Exportar esta parte
        </button>
      </div>
    </div>
  );

  /* ════ Contenido por sección ════ */
  let contenido: React.ReactNode = null;

  if (seccion.startsWith("kpi-")) {
    const kpi = KPIS[Number(seccion.slice(4))];
    const serie = horaResumen.map((h) => ({
      label: h.hora,
      value: h[kpi.metrica],
      tip: [`${h.hora} · ${h.ejecuciones} ejecuciones`, `${h[kpi.metrica]} ${kpi.unidad}`],
    }));

    /* El gráfico se elige según lo que representa el indicador. */
    let grafico: React.ReactNode;
    if (kpi.grafico === "hbar") {
      const cuenta = (est: string) => ventana.filter((e) => e.estado === est).length;
      grafico = (
        <HBarChart
          data={[
            { label: "Correcta", value: cuenta("correcta"), tip: ["Correcta", "Ejecuciones sin incidencias"] },
            { label: "Con errores", value: cuenta("con_errores"), tip: ["Con errores", "Registros inválidos omitidos"] },
            { label: "Fallida", value: cuenta("fallida"), tip: ["Fallida", "Timeout o error del proveedor"] },
            { label: "En curso", value: cuenta("en_curso"), tip: ["En curso", "Sincronización en progreso"] },
          ]}
          height={220}
          labelWidth="w-28"
          ariaLabel="Distribución de ejecuciones por estado"
        />
      );
    } else if (kpi.grafico === "area") {
      grafico = <AreaChart data={serie} height={240} ariaLabel={kpi.tituloGrafico} />;
    } else {
      const refLine = kpi.metrica === "pctExito" ? { value: 95, label: "Objetivo 95 %" } : null;
      const overlay = kpi.metrica === "duplicados" ? { label: "Insertados", values: horaResumen.map((h) => h.insertados) } : null;
      grafico = <BarChart data={serie} height={240} refLine={refLine} overlay={overlay} ariaLabel={kpi.tituloGrafico} />;
    }
    const columnas = [
      { key: "hora", label: "Hora (UTC-5)" },
      { key: "ejecuciones", label: "Ejecuciones" },
      { key: "correctas", label: "Correctas" },
      { key: "conErrores", label: "Con errores" },
      { key: "fallidas", label: "Fallidas" },
      { key: "pctExito", label: "Tasa éxito" },
      { key: "latenciaMedia", label: "Latencia media" },
      { key: "insertados", label: "Insertados" },
      { key: "corregidos", label: "Corregidos" },
      { key: "duplicados", label: "Duplicados" },
    ];
    contenido = (
      <>
        <Barra>
          {filtroPeriodo}
          {filtroEstado}
          <span className="ml-auto text-[11px] text-content-muted">
            {ventana.length} ejecuciones · {horaResumen.length} horas
          </span>
          <Reiniciar onClick={filtrarRestablecer} />
        </Barra>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta={kpi.etiqueta} valor={resumen ? kpi.valor(resumen) : "—"} detalle={kpi.detalle} />
          {seccion === "kpi-1" && resumen && <Dato etiqueta="Fecha (UTC-5)" valor={fmtDateUTC5(resumen.ultimoExitoUtc)} detalle={detalleUltimoExito(resumen)} />}
          {seccion === "kpi-3" && <Dato etiqueta="Ejecuciones finalizadas" valor={String(ventana.filter((e) => e.estado !== "en_curso").length)} detalle="Con los filtros actuales" />}
          {seccion === "kpi-4" && resumen && <Dato etiqueta="Duplicados omitidos" valor={resumen.duplicadosOmitidos.toLocaleString("es-PE")} detalle="Ingesta idempotente" />}
          {seccion === "kpi-5" && resumen && <Dato etiqueta="Registros insertados" valor={resumen.registrosInsertados.toLocaleString("es-PE")} detalle={`Tras deduplicar · ${resumen.registrosCorregidos.toLocaleString("es-PE")} corregidos por la fuente`} />}
        </div>

        <div className="mt-4 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2.5">
          <p className="text-xs font-semibold text-content">{kpi.descripcion}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-content-secondary">{kpi.calculo}</p>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-surface p-3.5">
          <h3 className="mb-2 text-xs font-semibold text-content">
            {kpi.tituloGrafico} <span className="font-normal text-content-muted">({kpi.unidad})</span>
          </h3>
          {grafico}
        </div>

        <div className="mt-4 rounded-lg border border-border bg-surface p-3.5">
          <h3 className="mb-2 text-xs font-semibold text-content">Detalle por hora</h3>
          <DataTable columns={columnas} data={horaResumen as unknown as Record<string, React.ReactNode>[]} emptyMessage="Sin ejecuciones para los filtros seleccionados." />
        </div>
      </>
    );
  } else if (seccion === "conector" && ficha) {
    const p = paginar(ventana);
    contenido = (
      <>
        <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          <Fila etiqueta="Nombre">{ficha.nombre}</Fila>
          <Fila etiqueta="Organización">{ficha.organizacion}</Fila>
          <Fila etiqueta="Tipo">{ficha.tipo}</Fila>
          <Fila etiqueta="URL / API">
            <a href={ficha.urlApi} target="_blank" rel="noopener noreferrer" className="text-accent-600 hover:underline">
              {ficha.urlApi}
            </a>
          </Fila>
          <Fila etiqueta="Frecuencia">{ficha.frecuencia}</Fila>
          <Fila etiqueta="Última ejecución (UTC-5)">{fmtDateTimeUTC5(ficha.ultimaEjecucionUtc)}</Fila>
          <Fila etiqueta="Último éxito (UTC-5)">{fmtDateTimeUTC5(ficha.ultimoExitoUtc)}</Fila>
          <Fila etiqueta="Latencia media">{ficha.latenciaMs} ms</Fila>
          <Fila etiqueta="Límites de uso">{ficha.limitesUso ?? <span className="italic text-content-muted">pendiente</span>}</Fila>
          <Fila etiqueta="Licencia">{ficha.licencia ?? <span className="italic text-content-muted">pendiente</span>}</Fila>
          <Fila etiqueta="Contacto">{ficha.contacto ?? <span className="italic text-content-muted">pendiente</span>}</Fila>
          <Fila etiqueta="Credenciales">
            <code className="font-mono text-[11px] text-content">{ficha.credencialRef}</code>
          </Fila>
        </dl>

        <div className="mt-4 rounded-lg border border-border bg-surface p-3.5">
          <div className="mb-2.5 flex flex-wrap items-end gap-3">
            <h3 className="mr-auto text-xs font-semibold text-content">Ejecuciones del conector</h3>
            {filtroPeriodo}
            {filtroEstado}
            {filtroOrden}
            {filtroFilas}
            <Reiniciar onClick={filtrarRestablecer} />
          </div>
          {paginacion(p, "ejecuciones")}
          <DataTable
            columns={[
              { key: "id", label: "Ejecución" },
              { key: "inicio", label: "Inicio (UTC-5)" },
              { key: "estado", label: "Estado" },
              { key: "latencia", label: "Latencia" },
              { key: "insertados", label: "Insertados" },
            ]}
            data={p.visibles.map((e) => ({
              id: <code className="font-mono text-[11px] text-content-secondary">{e.id}</code>,
              inicio: fmtDateTimeUTC5(e.inicioUtc),
              estado: <StatusBadge status={e.estado} label={ETIQUETA_EJECUCION[e.estado]} colorClass={COLOR_EJECUCION[e.estado]} />,
              latencia: `${e.latenciaMs} ms`,
              insertados: e.insertados,
            }))}
            onRowClick={(_r, i) => setDetalleId(p.visibles[i].id)}
            emptyMessage="Sin ejecuciones para los filtros seleccionados."
          />
        </div>
      </>
    );
  } else if (seccion === "latencia") {
    const cronologico = ventana.slice().sort((a, b) => a.inicioUtc.localeCompare(b.inicioUtc));
    const puntos: PuntoLatencia[] = cronologico.map((e) => ({
      label: fmtTimeUTC5(e.inicioUtc),
      value: e.latenciaMs,
      estado: e.estado,
      tip: [`${fmtTimeUTC5(e.inicioUtc)} · ${ETIQUETA_EJECUCION[e.estado]}`, `${e.latenciaMs} ms`, `${e.insertados} insertados`, `${e.corregidos} corregidos`],
    }));
    const st = estadisticasLatencia(ventana);
    contenido = (
      <div className="flex flex-1 min-h-0 flex-col">
        <Barra>
          {filtroPeriodo}
          {filtroEstado}
          <span className="ml-auto text-[11px] text-content-muted">
            {ventana.length} ejecuciones · {st.n} con latencia
          </span>
          <Reiniciar onClick={filtrarRestablecer} />
        </Barra>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 shrink-0">
          <Dato etiqueta="Mínima" valor={`${st.min} ms`} />
          <Dato etiqueta="Mediana" valor={`${st.mediana} ms`} />
          <Dato etiqueta="Media" valor={`${st.media} ms`} />
          <Dato etiqueta="Percentil 95" valor={`${st.p95} ms`} />
          <Dato etiqueta="Máxima" valor={`${st.max} ms`} detalle={`${st.n} ejecuciones`} />
        </div>
        <div className="mt-3 flex-1 min-h-0 rounded-lg border border-border bg-surface p-3.5">
          <GraficoLatencia data={puntos} fill onPuntoClick={(i) => setDetalleId(cronologico[i].id)} />
        </div>
      </div>
    );
  } else if (seccion === "ejecuciones") {
    const filtradas = ventana.filter((e) => !buscar || e.id.toLowerCase().includes(buscar) || (e.errorResumen ?? "").toLowerCase().includes(buscar));
    const p = paginar(filtradas);
    const columnas = [
      { key: "id", label: "Ejecución" },
      { key: "inicio", label: "Inicio (UTC-5)" },
      { key: "duracion", label: "Duración" },
      { key: "estado", label: "Estado" },
      { key: "leidos", label: "Leídos" },
      { key: "insertados", label: "Insertados" },
      { key: "corregidos", label: "Corregidos" },
      { key: "duplicados", label: "Duplicados" },
      { key: "error", label: "Error" },
    ];
    const filas = p.visibles.map((e) => ({
      id: <code className="font-mono text-[11px] text-content-secondary">{e.id}</code>,
      inicio: <span className="whitespace-nowrap">{fmtDateTimeUTC5(e.inicioUtc)}</span>,
      duracion: <span className="whitespace-nowrap text-content-secondary">{e.duracionMs} ms</span>,
      estado: <StatusBadge status={e.estado} label={ETIQUETA_EJECUCION[e.estado]} colorClass={COLOR_EJECUCION[e.estado]} />,
      leidos: e.leidos,
      insertados: <b className="font-semibold">{e.insertados}</b>,
      corregidos: e.corregidos,
      duplicados: e.duplicadosOmitidos,
      error: e.errorResumen ? <span className="line-clamp-1 text-content-secondary" title={e.errorResumen}>{e.errorResumen}</span> : <span className="text-content-muted">—</span>,
    }));
    contenido = (
      <>
        <Barra>
          {filtroPeriodo}
          {filtroEstado}
          {filtroOrden}
          {filtroFilas}
          <Buscador value={busca} onChange={setBusca} placeholder="ID o error…" />
          <span className="ml-auto text-[11px] text-content-muted">{p.total} de {ventana.length} ejecuciones</span>
          <Reiniciar onClick={filtrarRestablecer} />
        </Barra>
        <div className="rounded-lg border border-border bg-surface p-3.5">
          {paginacion(p, "ejecuciones")}
          <DataTable columns={columnas} data={filas} onRowClick={(_r, i) => setDetalleId(p.visibles[i].id)} emptyMessage="Sin ejecuciones para los filtros seleccionados." />
        </div>
      </>
    );
  } else if (seccion === "calidad") {
    const filtradas = calidad.filter((c) => !buscar || c.campo.toLowerCase().includes(buscar));
    const p = paginar(filtradas);
    const columnas = [
      { key: "campo", label: "Campo" },
      { key: "nulos", label: "% de nulos" },
      { key: "ejemplo", label: "Valor de ejemplo" },
      { key: "observacion", label: "Observación" },
    ];
    const filas = p.visibles.map((c) => ({
      campo: <code className="font-mono text-[11px] text-content">{c.campo}</code>,
      nulos: (
        <span className="tabular-nums text-content-secondary">
          {c.pctNulos.toFixed(1)}% <span className="text-content-muted">({c.nulos} de {c.total})</span>
        </span>
      ),
      ejemplo: <code className="font-mono text-[11px] text-content-secondary">{c.valorEjemplo}</code>,
      observacion: c.observacion ?? <span className="italic text-content-muted">Sin observaciones</span>,
    }));
    contenido = (
      <>
        <Barra>
          {filtroFilas}
          <Buscador value={busca} onChange={setBusca} placeholder="Nombre del campo…" />
          <span className="ml-auto text-[11px] text-content-muted">{p.total} de {calidad.length} campos</span>
          <Reiniciar onClick={filtrarRestablecer} />
        </Barra>
        <div className="rounded-lg border border-border bg-surface p-3.5">
          {paginacion(p, "campos")}
          <DataTable columns={columnas} data={filas} onRowClick={(_r, i) => setCampoSel(p.visibles[i])} emptyMessage="Sin métricas de calidad." />
        </div>
        {campoSel && (
          <div className="mt-3 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2.5 text-[11px] leading-relaxed text-content-secondary">
            <b className="font-semibold text-content">{campoSel.campo}</b> · {campoSel.pctNulos.toFixed(1)}% de nulos ({campoSel.nulos} de {campoSel.total} eventos) · ejemplo{" "}
            <code className="font-mono">{campoSel.valorEjemplo}</code>
            {campoSel.observacion ? `. ${campoSel.observacion}` : ". Sin observaciones."}
          </div>
        )}
        <p role="note" className="mt-3 rounded-lg border border-border bg-surface px-3.5 py-2 text-[11px] leading-relaxed text-content-secondary">
          La deduplicación se hace por hash de origen; la frescura se controla con la frecuencia de ingesta (cada 15 min).
        </p>
      </>
    );
  } else if (seccion === "registro") {
    const filtradas = registro.filter(
      (l) => !buscar || l.mensaje.toLowerCase().includes(buscar) || l.correlacion.toLowerCase().includes(buscar),
    );
    const p = paginar(filtradas);
    const columnas = [
      { key: "hora", label: "Hora (UTC-5)" },
      { key: "nivel", label: "Nivel" },
      { key: "mensaje", label: "Mensaje" },
      { key: "correlacion", label: "Correlación" },
    ];
    const filas = p.visibles.map((l) => ({
      hora: <span className="whitespace-nowrap">{fmtDateTimeUTC5(l.horaUtc)}</span>,
      nivel: <StatusBadge status={l.nivel} label={ETIQUETA_NIVEL[l.nivel]} colorClass={COLOR_NIVEL[l.nivel]} />,
      mensaje: l.mensaje,
      correlacion: <code className="font-mono text-[11px] text-content-muted">{l.correlacion}</code>,
    }));
    contenido = (
      <>
        <Barra>
          <CampoSelect label="Nivel" value={nivel} onChange={(v) => setNivel(v as FiltrosLogs["nivel"])} opciones={NIVELES_LOG} />
          {filtroOrden}
          {filtroFilas}
          <Buscador value={busca} onChange={setBusca} placeholder="Mensaje o correlación…" />
          <span className="ml-auto text-[11px] text-content-muted">{p.total} de {registro.length} entradas</span>
          <Reiniciar onClick={filtrarRestablecer} />
        </Barra>
        <div className="rounded-lg border border-border bg-surface p-3.5">
          {paginacion(p, "entradas")}
          <DataTable columns={columnas} data={filas} emptyMessage="Sin entradas para los filtros seleccionados." />
        </div>
      </>
    );
  } else if (seccion === "configuracion" && configuracion) {
    contenido = (
      <>
        <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
          <Fila etiqueta="Frecuencia">{`Cada ${configuracion.frecuenciaMin} min`}</Fila>
          <Fila etiqueta="URL / API">{configuracion.urlApi}</Fila>
          <Fila etiqueta="Reintentos">{configuracion.reintentos}</Fila>
          <Fila etiqueta="Timeout">{`${configuracion.timeoutSeg} s`}</Fila>
          <Fila etiqueta="Ingesta idempotente">{configuracion.ingestaIdempotente ? "Sí" : "No"}</Fila>
          <Fila etiqueta="Notificar errores">{configuracion.notificarErrores ? "Sí" : "No"}</Fila>
          <Fila etiqueta="Límites de uso">{configuracion.limitesUso || <span className="italic text-content-muted">pendiente</span>}</Fila>
          <Fila etiqueta="Licencia">{configuracion.licencia || <span className="italic text-content-muted">pendiente</span>}</Fila>
          <Fila etiqueta="Contacto">{configuracion.contacto || <span className="italic text-content-muted">pendiente</span>}</Fila>
        </dl>
        <p role="note" className="mt-3 flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2 text-[11px] leading-relaxed text-content-secondary">
          <IconInfo size={13} className="mt-0.5 shrink-0" />
          Vista de solo lectura. La edición está disponible en la pestaña <b className="font-semibold text-content">Configuración</b> para el rol Administrador; los cambios quedan registrados en Auditoría.
        </p>
      </>
    );
  }

  /** Arrastra el divisor para cambiar el ancho del panel de detalle. */
  const dividirDetalle = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const iniX = e.clientX;
    const iniW = anchoDetalle;
    const fila = filaRef.current;
    const maxW = fila ? Math.max(300, fila.clientWidth - 360) : 720;
    setArrastrando(true);
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const mover = (ev: PointerEvent) => {
      setAnchoDetalle(Math.min(Math.max(iniW - (ev.clientX - iniX), 260), maxW));
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

  const panelDetalle = ejecucionDetalle && (
    <aside
      aria-label="Detalle de la ejecución"
      className="flex w-full shrink-0 flex-col overflow-y-auto rounded-lg border border-border bg-surface p-4 lg:w-[var(--detalle-w)] lg:max-h-full"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-mono text-xs font-semibold text-content">{ejecucionDetalle.id}</h3>
        <button
          type="button"
          onClick={() => setDetalleId(null)}
          className="p-1 rounded-md text-content-muted transition-colors hover:bg-surface-tertiary hover:text-content"
          aria-label="Cerrar detalle"
        >
          <IconClose size={15} />
        </button>
      </div>
      <DetalleEjecucion
        ejecucion={ejecucionDetalle}
        posicion={idxDetalle + 1}
        total={ventana.length}
        hayAnterior={idxDetalle > 0}
        haySiguiente={idxDetalle < ventana.length - 1}
        onAnterior={() => setDetalleId(ventana[Math.max(0, idxDetalle - 1)].id)}
        onSiguiente={() => setDetalleId(ventana[Math.min(ventana.length - 1, idxDetalle + 1)].id)}
        compacto
      />
    </aside>
  );

  return (
    <ExpandModal title={titulo} onClose={onCerrar} footer={pie} resizable>
      {() => (
        <div
          ref={filaRef}
          className="flex w-full flex-1 min-h-0 min-w-0 flex-col gap-4 overflow-y-auto lg:flex-row lg:overflow-hidden"
          style={{ ["--detalle-w" as string]: `${anchoDetalle}px` } as CSSProperties}
        >
          <div className="flex flex-1 min-w-0 flex-col lg:min-h-0 lg:overflow-y-auto">{contenido}</div>
          {ejecucionDetalle && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Ajustar el ancho del detalle"
              tabIndex={0}
              onPointerDown={dividirDetalle}
              onDoubleClick={() => setAnchoDetalle(360)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  setAnchoDetalle((w) => Math.min(w + 24, 720));
                } else if (e.key === "ArrowRight") {
                  e.preventDefault();
                  setAnchoDetalle((w) => Math.max(w - 24, 260));
                }
              }}
              title="Arrastra para ajustar el ancho del detalle (doble clic restablece)"
              className={`hidden w-1.5 shrink-0 cursor-col-resize touch-none rounded-full transition-colors focus:outline-none lg:block ${
                arrastrando ? "bg-accent-500" : "bg-border hover:bg-accent-500 focus-visible:bg-accent-500"
              }`}
            />
          )}
          {panelDetalle}
        </div>
      )}
    </ExpandModal>
  );
}
