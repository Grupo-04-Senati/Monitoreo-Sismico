import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@/app/auth/AuthContext";
import { ApiError } from "@/lib/api";
import { fmtTimeUTC5 } from "@/lib/format";
import { useMeta } from "@/lib/useMeta";
import { IconCheck, IconClock, IconInfo } from "@/components/ui/Icons";
import type { EstadoEstimacion, Estimacion, ModeloOpcion, PaginaEstimaciones } from "./types";
import { CLASE_EXPERIMENTAL, ETIQUETA_ESTADO } from "./schemas/estimaciones.schema";
import {
  generarEstimacion,
  listarEstimaciones,
  modelosParaEstimar,
  obtenerEstimacion,
  revisarEstimacion,
} from "./services/estimaciones.service";
import AvisoEstimaciones from "./components/AvisoEstimaciones";
import NuevaEstimacion from "./components/NuevaEstimacion";
import TablaEstimaciones from "./components/TablaEstimaciones";
import DetalleEstimacionModal from "./components/DetalleEstimacionModal";

const TAMANO = 10;

function mensaje(error: unknown, porDefecto: string): string {
  return error instanceof ApiError && error.detail ? error.detail : porDefecto;
}

export default function EstimacionesPage() {
  const { user, canAccess } = useAuth();
  const puedeGenerar = canAccess("estimaciones");
  const puedeRevisar = user?.role === "admin";

  const [estado, setEstado] = useState<EstadoEstimacion | "">("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<PaginaEstimaciones | null>(null);
  const [modelos, setModelos] = useState<ModeloOpcion[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  const [generando, setGenerando] = useState(false);
  const [errorGenerar, setErrorGenerar] = useState<string | null>(null);
  const [seleccionada, setSeleccionada] = useState<Estimacion | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const metaIso = useMeta();

  useEffect(() => {
    let vivo = true;
    modelosParaEstimar()
      .then((m) => {
        if (vivo) setModelos(m);
      })
      .catch(() => {
        if (vivo) setModelos([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(false);
    listarEstimaciones(estado, pagina, TAMANO)
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
  }, [estado, pagina, nonce]);

  const refrescar = useCallback(() => setNonce((n) => n + 1), []);

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(null), 3600);
  }, []);

  const generar = useCallback(
    async (modelId: string) => {
      setGenerando(true);
      setErrorGenerar(null);
      try {
        const e = await generarEstimacion(modelId);
        mostrarAviso("Estimación generada · queda en revisión");
        setPagina(1);
        refrescar();
        setSeleccionada(e);
      } catch (err) {
        setErrorGenerar(mensaje(err, "No se pudo generar la estimación."));
      } finally {
        setGenerando(false);
      }
    },
    [mostrarAviso, refrescar],
  );

  const abrir = useCallback(
    async (e: Estimacion) => {
      try {
        setSeleccionada(await obtenerEstimacion(e.id));
      } catch {
        mostrarAviso("No se pudo abrir la estimación.");
      }
    },
    [mostrarAviso],
  );

  const revisar = useCallback(
    async (e: Estimacion, accion: "publish" | "withdraw") => {
      setRevisando(true);
      try {
        const r = await revisarEstimacion(e.id, accion);
        setSeleccionada(r);
        mostrarAviso(accion === "publish" ? "Estimación publicada (sigue siendo experimental)" : "Estimación retirada");
        refrescar();
      } catch (err) {
        mostrarAviso(mensaje(err, "No se pudo actualizar la estimación."));
      } finally {
        setRevisando(false);
      }
    },
    [mostrarAviso, refrescar],
  );

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-xs text-content-muted">
        <Link to="/" className="transition-colors hover:text-content">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-content-secondary">Estimaciones</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-content">Estimaciones</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${CLASE_EXPERIMENTAL}`}>
              Estimación experimental — no es alerta oficial
            </span>
          </div>
          <p className="mt-0.5 text-xs text-content-muted">
            Resultados de modelos aprobados con su incertidumbre, comparados con la media histórica.
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-content-muted">
          <IconClock size={14} />
          Actualizado: <b className="font-medium text-content-secondary">{fmtTimeUTC5(metaIso)}</b> (UTC-5)
        </span>
      </div>

      <AvisoEstimaciones texto={datos?.disclaimer} />

      {error && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2.5 text-xs text-content-secondary"
        >
          <IconInfo size={14} className="shrink-0 text-rose-600" />
          <span>No se pudo conectar con la API de estimaciones.</span>
          <button
            type="button"
            onClick={refrescar}
            className="ml-auto rounded-md border border-border px-2.5 py-1 font-medium text-content transition-colors hover:bg-surface-secondary"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="mb-3">
        <NuevaEstimacion
          puedeGenerar={puedeGenerar}
          modelos={modelos}
          generando={generando}
          errorApi={errorGenerar}
          onGenerar={generar}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-content-secondary">Estado:</span>
        {(["", "en_revision", "publicada", "retirada"] as const).map((e) => (
          <button
            key={e || "todas"}
            type="button"
            onClick={() => {
              setEstado(e);
              setPagina(1);
            }}
            className={`rounded-md border px-2.5 py-1 transition-colors ${
              estado === e ? "border-accent-500 bg-accent-600 text-white" : "border-border text-content-secondary hover:bg-surface-tertiary"
            }`}
          >
            {e === "" ? "Todas" : ETIQUETA_ESTADO[e]}
          </button>
        ))}
      </div>

      <TablaEstimaciones datos={datos} cargando={cargando} onAbrir={abrir} onPagina={setPagina} />

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-content-muted">
        <IconInfo size={12} />
        Generar: Analista o Administrador · Publicar o retirar: solo Administrador · Nunca se envía como alerta · n ={" "}
        {datos ? datos.total : "—"} estimaciones
      </p>

      {seleccionada && (
        <DetalleEstimacionModal
          key={seleccionada.id + seleccionada.status}
          estimacion={seleccionada}
          puedeRevisar={puedeRevisar}
          revisando={revisando}
          onRevisar={revisar}
          onCerrar={() => setSeleccionada(null)}
        />
      )}

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
