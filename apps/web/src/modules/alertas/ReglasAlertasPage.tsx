import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/auth/AuthContext";
import { ApiError } from "@/lib/api";
import { IconAlertRule, IconCheck, IconInfo } from "@/components/ui/Icons";
import type { Regla, ReglaIn } from "./types";
import { cambiarEstadoRegla, crearRegla, editarRegla, listarReglas } from "./services/alertas.service";
import AvisoAlertas from "./components/AvisoAlertas";
import TablaReglas from "./components/TablaReglas";
import DetalleReglaModal from "./components/DetalleReglaModal";
import EditorReglaModal from "./components/EditorReglaModal";

function mensaje(error: unknown, porDefecto: string): string {
  return error instanceof ApiError && error.detail ? error.detail : porDefecto;
}

/** Editor abierto: nueva regla (null) o una regla inactiva. */
type Editor = { regla: Regla | null } | null;

export default function ReglasAlertasPage() {
  const { user } = useAuth();
  const esAdmin = user?.role === "admin";

  const [reglas, setReglas] = useState<Regla[] | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  const [seleccionada, setSeleccionada] = useState<Regla | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(false);
    listarReglas()
      .then((r) => {
        if (vivo) {
          setReglas(r);
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
  }, [nonce]);

  const refrescar = useCallback(() => setNonce((n) => n + 1), []);
  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(null), 3600);
  }, []);

  const abrirEditor = (regla: Regla | null) => {
    setErrorGuardar(null);
    setSeleccionada(null);
    setEditor({ regla });
  };

  const guardar = async (cuerpo: ReglaIn) => {
    if (!editor) return;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      const r = editor.regla ? await editarRegla(editor.regla.id, cuerpo) : await crearRegla(cuerpo);
      mostrarAviso(editor.regla ? "Regla actualizada · queda inactiva" : "Regla creada · queda inactiva hasta que un Administrador la active");
      setEditor(null);
      setSeleccionada(r);
      refrescar();
    } catch (err) {
      setErrorGuardar(mensaje(err, "No se pudo guardar la regla."));
    } finally {
      setGuardando(false);
    }
  };

  const activar = async (r: Regla, activa: boolean) => {
    setCambiando(true);
    try {
      setSeleccionada(await cambiarEstadoRegla(r.id, activa));
      mostrarAviso(activa ? "Regla activada · evaluará los próximos sismos" : "Regla desactivada · no generará avisos");
      refrescar();
    } catch (err) {
      mostrarAviso(mensaje(err, "No se pudo cambiar el estado de la regla."));
    } finally {
      setCambiando(false);
    }
  };

  const activas = reglas?.filter((r) => r.enabled).length ?? null;

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-xs text-content-muted">
        <Link to="/" className="transition-colors hover:text-content">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-content-secondary">Reglas de alertas</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Reglas de alertas</h1>
          <p className="mt-0.5 text-xs text-content-muted">
            Qué sismos generan un aviso interno, para qué zona y por qué canales.
          </p>
        </div>
        <button
          type="button"
          onClick={() => abrirEditor(null)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500"
        >
          <IconAlertRule size={13} />
          Nueva regla
        </button>
      </div>

      <AvisoAlertas>Toda regla nace inactiva; simúlala antes de pedir su activación.</AvisoAlertas>

      {error && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2.5 text-xs text-content-secondary"
        >
          <IconInfo size={14} className="shrink-0 text-rose-600" />
          <span>No se pudo conectar con la API de reglas.</span>
          <button
            type="button"
            onClick={refrescar}
            className="ml-auto rounded-md border border-border px-2.5 py-1 font-medium text-content transition-colors hover:bg-surface-secondary"
          >
            Reintentar
          </button>
        </div>
      )}

      <TablaReglas reglas={reglas} cargando={cargando} onAbrir={setSeleccionada} />

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-content-muted">
        <IconInfo size={12} />
        Crear, editar, simular y desactivar: Operador de alertas o Administrador · Activar: solo Administrador ·{" "}
        {reglas ? `${activas} de ${reglas.length} activas` : "—"}
      </p>

      {seleccionada && (
        <DetalleReglaModal
          key={seleccionada.id + String(seleccionada.enabled)}
          regla={seleccionada}
          esAdmin={esAdmin}
          cambiando={cambiando}
          onActivar={activar}
          onEditar={abrirEditor}
          onCerrar={() => setSeleccionada(null)}
        />
      )}

      {editor && (
        <EditorReglaModal
          regla={editor.regla}
          guardando={guardando}
          errorApi={errorGuardar}
          onGuardar={guardar}
          onCerrar={() => setEditor(null)}
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
