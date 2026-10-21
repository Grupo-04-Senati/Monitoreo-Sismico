import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/auth/AuthContext";
import { ApiError } from "@/lib/api";
import { fmtTimeUTC5 } from "@/lib/format";
import { useMeta } from "@/lib/useMeta";
import { IconCheck, IconClock, IconInfo } from "@/components/ui/Icons";
import type { DatasetOpcion, EstadoExperimento, Experimento, ModeloAprobado, NuevoExperimento as Formulario, PaginaExperimentos } from "./types";
import { ETIQUETA_ESTADO } from "./schemas/ml.schema";
import {
  aprobarModelo,
  crearExperimento,
  datasetsAprobados,
  listarExperimentos,
  listarModelos,
  obtenerExperimento,
} from "./services/ml.service";
import AvisoModelos from "./components/AvisoModelos";
import NuevoExperimento from "./components/NuevoExperimento";
import TablaExperimentos from "./components/TablaExperimentos";
import TablaModelos from "./components/TablaModelos";
import DetalleExperimentoModal from "./components/DetalleExperimentoModal";

const TAMANO = 10;

function mensaje(error: unknown, porDefecto: string): string {
  return error instanceof ApiError && error.detail ? error.detail : porDefecto;
}

export default function ModelosMLPage() {
  const { user, canAccess } = useAuth();
  const puedeEntrenar = canAccess("modelos");
  const puedeAprobar = user?.role === "admin";

  const [estado, setEstado] = useState<EstadoExperimento | "">("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<PaginaExperimentos | null>(null);
  const [modelos, setModelos] = useState<ModeloAprobado[] | null>(null);
  const [datasets, setDatasets] = useState<DatasetOpcion[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  const [entrenando, setEntrenando] = useState(false);
  const [errorEntrenar, setErrorEntrenar] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<Experimento | null>(null);
  const [aprobando, setAprobando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const metaIso = useMeta();

  useEffect(() => {
    let vivo = true;
    datasetsAprobados()
      .then((d) => {
        if (vivo) setDatasets(d);
      })
      .catch(() => {
        if (vivo) setDatasets([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(false);
    Promise.all([listarExperimentos(estado, pagina, TAMANO), listarModelos()])
      .then(([d, m]) => {
        if (vivo) {
          setDatos(d);
          setModelos(m);
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
    setTimeout(() => setAviso(null), 3800);
  }, []);

  const entrenar = useCallback(
    async (formulario: Formulario) => {
      setEntrenando(true);
      setErrorEntrenar(null);
      try {
        const e = await crearExperimento(formulario);
        mostrarAviso(
          e.status === "completado" ? `Experimento entrenado · ${e.name}` : `El experimento falló y quedó registrado · ${e.name}`,
        );
        setPagina(1);
        refrescar();
        setSeleccionado(e);
      } catch (err) {
        setErrorEntrenar(mensaje(err, "No se pudo entrenar el experimento."));
      } finally {
        setEntrenando(false);
      }
    },
    [mostrarAviso, refrescar],
  );

  const abrir = useCallback(async (id: string) => {
    try {
      setSeleccionado(await obtenerExperimento(id));
    } catch {
      mostrarAviso("No se pudo abrir el experimento.");
    }
  }, [mostrarAviso]);

  const aprobar = useCallback(
    async (e: Experimento, limitaciones: string) => {
      setAprobando(true);
      try {
        const m = await aprobarModelo(e.id, limitaciones);
        mostrarAviso(`Modelo aprobado · ${m.name} v${m.version}`);
        setSeleccionado(await obtenerExperimento(e.id));
        refrescar();
      } catch (err) {
        mostrarAviso(mensaje(err, "No se pudo aprobar el modelo."));
      } finally {
        setAprobando(false);
      }
    },
    [mostrarAviso, refrescar],
  );

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-xs text-content-muted">
        <Link to="/" className="transition-colors hover:text-content">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-content-secondary">Modelos ML</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Modelos ML</h1>
          <p className="mt-0.5 text-xs text-content-muted">
            Experimentos reproducibles sobre datasets aprobados, comparados con referencias, y registro de modelos aprobados.
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-content-muted">
          <IconClock size={14} />
          Actualizado: <b className="font-medium text-content-secondary">{fmtTimeUTC5(metaIso)}</b> (UTC-5)
        </span>
      </div>

      <AvisoModelos />

      {error && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2.5 text-xs text-content-secondary"
        >
          <IconInfo size={14} className="shrink-0 text-rose-600" />
          <span>No se pudo conectar con la API de modelos.</span>
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
        <NuevoExperimento
          puedeEntrenar={puedeEntrenar}
          datasets={datasets}
          entrenando={entrenando}
          errorApi={errorEntrenar}
          onEntrenar={entrenar}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-content-secondary">Estado:</span>
        {(["", "completado", "fallido"] as const).map((e) => (
          <button
            key={e || "todos"}
            type="button"
            onClick={() => {
              setEstado(e);
              setPagina(1);
            }}
            className={`rounded-md border px-2.5 py-1 transition-colors ${
              estado === e ? "border-accent-500 bg-accent-600 text-white" : "border-border text-content-secondary hover:bg-surface-tertiary"
            }`}
          >
            {e === "" ? "Todos" : ETIQUETA_ESTADO[e]}
          </button>
        ))}
      </div>

      <TablaExperimentos datos={datos} cargando={cargando} onAbrir={(e) => abrir(e.id)} onPagina={setPagina} />

      <div className="mt-3">
        <TablaModelos modelos={modelos} onAbrir={abrir} />
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-content-muted">
        <IconInfo size={12} />
        Entrenar: Analista o Administrador · Aprobar un modelo: solo Administrador · Todo queda en la Auditoría · n ={" "}
        {datos ? datos.total : "—"} experimentos
      </p>

      {seleccionado && (
        <DetalleExperimentoModal
          key={seleccionado.id + (seleccionado.model_id ?? "")}
          experimento={seleccionado}
          puedeAprobar={puedeAprobar}
          aprobando={aprobando}
          onAprobar={aprobar}
          onCerrar={() => setSeleccionado(null)}
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
