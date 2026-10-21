import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ApiError } from "@/lib/api";
import { fmtTimeUTC5 } from "@/lib/format";
import { IconCheck, IconClock, IconInfo } from "@/components/ui/Icons";
import type { Aviso, EstadoAviso, FiltrosAvisos, PaginaAvisos, Regla, Severidad } from "./types";
import { ESTADOS_AVISO, ETIQUETA_ESTADO, ETIQUETA_SEVERIDAD } from "./schemas/alertas.schema";
import {
  actuarAviso,
  cancelarAviso,
  contarAvisos,
  listarAvisos,
  listarReglas,
  obtenerAviso,
  type AccionAviso,
} from "./services/alertas.service";
import AvisoAlertas from "./components/AvisoAlertas";
import TablaAvisos from "./components/TablaAvisos";
import DetalleAvisoModal from "./components/DetalleAvisoModal";

const TAMANO = 15;

const MENSAJE_ACCION: Record<AccionAviso, string> = {
  approve: "Aviso aprobado · revisa el resultado de cada entrega",
  acknowledge: "Acuse de recibo registrado",
  retry: "Entregas reintentadas · revisa el resultado",
};

function mensaje(error: unknown, porDefecto: string): string {
  return error instanceof ApiError && error.detail ? error.detail : porDefecto;
}

const selectCls = "rounded-md border border-border bg-surface px-2 py-1 text-xs text-content";

export default function CentroAlertasPage() {
  const [params, setParams] = useSearchParams();
  const filtros: FiltrosAvisos = {
    estado: (params.get("estado") as EstadoAviso | null) ?? "",
    severidad: (params.get("severidad") as Severidad | null) ?? "",
    regla: params.get("regla") ?? "",
  };
  const [pagina, setPagina] = useState(1);

  const [datos, setDatos] = useState<PaginaAvisos | null>(null);
  const [conteos, setConteos] = useState<Partial<Record<EstadoAviso, number>>>({});
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [actualizado, setActualizado] = useState<string | null>(null);

  const [seleccionado, setSeleccionado] = useState<Aviso | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const clave = `${filtros.estado}|${filtros.severidad}|${filtros.regla}`;

  useEffect(() => {
    listarReglas().then(setReglas).catch(() => setReglas([]));
  }, []);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(false);
    listarAvisos(filtros, pagina, TAMANO)
      .then((d) => {
        if (vivo) {
          setDatos(d);
          setCargando(false);
          setActualizado(new Date().toISOString());
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
    // `clave` resume los filtros (el objeto se recrea en cada render).
  }, [clave, pagina, nonce]);

  useEffect(() => {
    let vivo = true;
    Promise.all(ESTADOS_AVISO.map((e) => contarAvisos(e).then((n) => [e, n] as const)))
      .then((pares) => {
        if (vivo) setConteos(Object.fromEntries(pares));
      })
      .catch(() => {
        if (vivo) setConteos({});
      });
    return () => {
      vivo = false;
    };
  }, [nonce]);

  const refrescar = useCallback(() => setNonce((n) => n + 1), []);
  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(null), 3600);
  }, []);

  const filtrar = (patch: Partial<FiltrosAvisos>) => {
    const siguiente = { ...filtros, ...patch };
    const p = new URLSearchParams();
    (Object.keys(siguiente) as (keyof FiltrosAvisos)[]).forEach((k) => {
      if (siguiente[k]) p.set(k, siguiente[k]);
    });
    setParams(p, { replace: true });
    setPagina(1);
  };

  const abrir = async (a: Aviso) => {
    try {
      setSeleccionado(await obtenerAviso(a.id));
    } catch {
      mostrarAviso("No se pudo abrir el aviso.");
    }
  };

  const ejecutar = async (trabajo: () => Promise<Aviso>, exito: string) => {
    setOcupado(true);
    try {
      setSeleccionado(await trabajo());
      mostrarAviso(exito);
      refrescar();
    } catch (err) {
      mostrarAviso(mensaje(err, "No se pudo actualizar el aviso."));
    } finally {
      setOcupado(false);
    }
  };

  const filtrado = !!(filtros.estado || filtros.severidad || filtros.regla);
  const porAtender = (conteos.pendiente_aprobacion ?? 0) + (conteos.fallida ?? 0);
  const reglaFiltrada = reglas.find((r) => r.id === filtros.regla);

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-xs text-content-muted">
        <Link to="/" className="transition-colors hover:text-content">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-content-secondary">Centro de alertas</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Centro de alertas</h1>
          <p className="mt-0.5 text-xs text-content-muted">
            Aprobar, cancelar, dar acuse y reintentar las entregas de los avisos internos.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-content-muted">
          <span className="flex items-center gap-1.5">
            <IconClock size={14} />
            Actualizado: <b className="font-medium text-content-secondary">{actualizado ? fmtTimeUTC5(actualizado) : "—"}</b> (UTC-5)
          </span>
          <button
            type="button"
            onClick={refrescar}
            className="rounded-md border border-border px-2.5 py-1 font-medium text-content transition-colors hover:bg-surface-tertiary"
          >
            Actualizar
          </button>
        </div>
      </div>

      <AvisoAlertas>
        {porAtender > 0
          ? `Hay ${porAtender} aviso${porAtender === 1 ? "" : "s"} por atender (pendientes de aprobación o con entrega fallida).`
          : null}
      </AvisoAlertas>

      {error && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2.5 text-xs text-content-secondary"
        >
          <IconInfo size={14} className="shrink-0 text-rose-600" />
          <span>No se pudo conectar con la API de avisos.</span>
          <button
            type="button"
            onClick={refrescar}
            className="ml-auto rounded-md border border-border px-2.5 py-1 font-medium text-content transition-colors hover:bg-surface-secondary"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-content-secondary">Estado:</span>
        {(["", ...ESTADOS_AVISO] as const).map((e) => (
          <button
            key={e || "todos"}
            type="button"
            onClick={() => filtrar({ estado: e })}
            aria-pressed={filtros.estado === e}
            className={`rounded-md border px-2.5 py-1 transition-colors ${
              filtros.estado === e ? "border-accent-500 bg-accent-600 text-white" : "border-border text-content-secondary hover:bg-surface-tertiary"
            }`}
          >
            {e === "" ? "Todos" : ETIQUETA_ESTADO[e]}
            {e !== "" && conteos[e] != null && <span className="ml-1 opacity-75">({conteos[e]})</span>}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <span className="font-medium text-content-secondary">Severidad:</span>
          <select value={filtros.severidad} onChange={(e) => filtrar({ severidad: e.target.value as Severidad | "" })} className={selectCls}>
            <option value="">Todas</option>
            {(Object.keys(ETIQUETA_SEVERIDAD) as Severidad[]).map((s) => (
              <option key={s} value={s}>{ETIQUETA_SEVERIDAD[s]}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="font-medium text-content-secondary">Regla:</span>
          <select value={filtros.regla} onChange={(e) => filtrar({ regla: e.target.value })} className={selectCls}>
            <option value="">Todas</option>
            {filtros.regla && !reglaFiltrada && <option value={filtros.regla}>Regla seleccionada</option>}
            {reglas.map((r) => (
              <option key={r.id} value={r.id}>{r.name}{r.enabled ? "" : " (inactiva)"}</option>
            ))}
          </select>
        </label>
        {filtrado && (
          <button
            type="button"
            onClick={() => filtrar({ estado: "", severidad: "", regla: "" })}
            className="text-xs font-medium text-accent-700 underline dark:text-accent-300"
          >
            Quitar filtros
          </button>
        )}
      </div>

      <TablaAvisos datos={datos} cargando={cargando} filtrado={filtrado} onAbrir={abrir} onPagina={setPagina} />

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-content-muted">
        <IconInfo size={12} />
        Operador de alertas o Administrador · Correo desactivado = entrega “simulada”, nunca un envío fingido ·{" "}
        <Link to="/reglas-alertas" className="underline">Reglas de alertas</Link>
      </p>

      {seleccionado && (
        <DetalleAvisoModal
          key={seleccionado.id + seleccionado.status + String(seleccionado.acknowledged_at)}
          aviso={seleccionado}
          ocupado={ocupado}
          onAccion={(a, accion) => ejecutar(() => actuarAviso(a.id, accion), MENSAJE_ACCION[accion])}
          onCancelar={(a, motivo) => ejecutar(() => cancelarAviso(a.id, motivo), "Aviso cancelado")}
          onCerrar={() => setSeleccionado(null)}
        />
      )}

      {aviso && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-[110] flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-xs text-content shadow-lg"
        >
          <IconCheck size={14} className="text-accent-600" />
          {aviso}
        </div>
      )}
    </div>
  );
}
