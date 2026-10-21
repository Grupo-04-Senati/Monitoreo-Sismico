import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/auth/AuthContext";
import { DATA_MAX_DAY, DATA_MIN_DAY } from "@/lib/ancla";
import { ApiError } from "@/lib/api";
import { fmtTimeUTC5 } from "@/lib/format";
import { useMeta } from "@/lib/useMeta";
import { IconCheck, IconClock, IconInfo } from "@/components/ui/Icons";
import type { Dataset, EstadoDataset, FuenteOpcion, NuevoDataset as Formulario, PaginaDatasets } from "./types";
import { ETIQUETA_ESTADO } from "./schemas/datasets.schema";
import { aprobarDataset, crearDataset, listarDatasets, listarFuentes, obtenerDataset } from "./services/datasets.service";
import AvisoPreparacion from "./components/AvisoPreparacion";
import NuevoDataset from "./components/NuevoDataset";
import TablaDatasets from "./components/TablaDatasets";
import DetalleDatasetModal from "./components/DetalleDatasetModal";

const TAMANO = 10;

function mensaje(error: unknown, porDefecto: string): string {
  return error instanceof ApiError && error.detail ? error.detail : porDefecto;
}

export default function PreparacionDatosPage() {
  const { user, canAccess } = useAuth();
  const puedeCrear = canAccess("preparacion");
  const puedeAprobar = user?.role === "admin";

  const [estado, setEstado] = useState<EstadoDataset | "">("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<PaginaDatasets | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  const [fuentes, setFuentes] = useState<FuenteOpcion[]>([]);
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<Dataset | null>(null);
  const [aprobando, setAprobando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const metaIso = useMeta();

  useEffect(() => {
    let vivo = true;
    listarFuentes()
      .then((f) => {
        if (vivo) setFuentes(f);
      })
      .catch(() => {
        /* Sin fuentes el formulario ofrece "Todas las fuentes". */
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(false);
    listarDatasets(estado, pagina, TAMANO)
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
    setTimeout(() => setAviso(null), 3400);
  }, []);

  const crear = useCallback(
    async (formulario: Formulario) => {
      setCreando(true);
      setErrorCrear(null);
      try {
        const nuevo = await crearDataset(formulario);
        mostrarAviso(`Dataset creado · ${nuevo.name} v${nuevo.version} (${nuevo.row_count.toLocaleString("es-PE")} filas)`);
        setPagina(1);
        refrescar();
        setSeleccionado(nuevo);
      } catch (e) {
        setErrorCrear(mensaje(e, "No se pudo crear el dataset."));
      } finally {
        setCreando(false);
      }
    },
    [mostrarAviso, refrescar],
  );

  const abrir = useCallback(async (d: Dataset) => {
    try {
      setSeleccionado(await obtenerDataset(d.id));
    } catch {
      setSeleccionado(d);
    }
  }, []);

  const aprobar = useCallback(
    async (d: Dataset) => {
      setAprobando(true);
      try {
        const aprobado = await aprobarDataset(d.id);
        setSeleccionado(aprobado);
        mostrarAviso(`Dataset aprobado · ${aprobado.name} v${aprobado.version} ya no se puede modificar`);
        refrescar();
      } catch (e) {
        mostrarAviso(mensaje(e, "No se pudo aprobar el dataset."));
      } finally {
        setAprobando(false);
      }
    },
    [mostrarAviso, refrescar],
  );

  return (
    <div>
      {/* Encabezado */}
      <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-xs text-content-muted">
        <Link to="/" className="transition-colors hover:text-content">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-content-secondary">Preparación de datos</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Preparación de datos</h1>
          <p className="mt-0.5 text-xs text-content-muted">
            Datasets versionados con reglas de limpieza, informe de calidad y partición temporal para análisis y ML.
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-content-muted">
          <IconClock size={14} />
          Actualizado: <b className="font-medium text-content-secondary">{fmtTimeUTC5(metaIso)}</b> (UTC-5)
        </span>
      </div>

      <AvisoPreparacion />

      {error && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2.5 text-xs text-content-secondary"
        >
          <IconInfo size={14} className="shrink-0 text-rose-600" />
          <span>No se pudo conectar con la API de datasets.</span>
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
        <NuevoDataset
          puedeCrear={puedeCrear}
          fuentes={fuentes}
          desdeInicial={DATA_MIN_DAY}
          hastaInicial={DATA_MAX_DAY}
          creando={creando}
          errorApi={errorCrear}
          onCrear={crear}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-content-secondary">Estado:</span>
        {(["", "borrador", "aprobado"] as const).map((e) => (
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

      <TablaDatasets datos={datos} cargando={cargando} onAbrir={abrir} onPagina={setPagina} />

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-content-muted">
        <IconInfo size={12} />
        Crear: Analista o Administrador · Aprobar: solo Administrador · Toda alta y aprobación queda en la Auditoría · n ={" "}
        {datos ? datos.total : "—"} datasets
      </p>

      {seleccionado && (
        <DetalleDatasetModal
          dataset={seleccionado}
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
