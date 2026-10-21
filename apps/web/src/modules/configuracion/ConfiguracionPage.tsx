import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/lib/api";
import { IconCheck, IconInfo } from "@/components/ui/Icons";
import type { Cambio, Configuracion, Parametro, Retencion } from "./types";
import {
  cambiarParametro,
  obtenerConfiguracion,
  obtenerHistorial,
  obtenerRetencion,
  purgarAuditoria,
} from "./services/configuracion.service";
import TarjetaParametro from "./components/TarjetaParametro";
import PanelRetencion from "./components/PanelRetencion";
import HistorialCambios from "./components/HistorialCambios";
import PanelEntorno from "./components/PanelEntorno";

function mensaje(error: unknown, porDefecto: string): string {
  return error instanceof ApiError && error.detail ? error.detail : porDefecto;
}

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [historial, setHistorial] = useState<Cambio[] | null>(null);
  const [retencion, setRetencion] = useState<Retencion | null>(null);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [purgando, setPurgando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setError(false);
    Promise.all([obtenerConfiguracion(), obtenerHistorial(), obtenerRetencion()])
      .then(([c, h, r]) => {
        if (!vivo) return;
        setConfig(c);
        setHistorial(h);
        setRetencion(r);
      })
      .catch(() => {
        if (vivo) setError(true);
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

  const guardar = async (p: Parametro, valor: number) => {
    setGuardando(p.clave);
    try {
      await cambiarParametro(p.clave, valor);
      mostrarAviso(`${p.etiqueta}: ${p.valor} → ${valor} ${p.unidad} · cambio registrado`);
      refrescar();
    } catch (err) {
      mostrarAviso(mensaje(err, "No se pudo guardar el parámetro."));
    } finally {
      setGuardando(null);
    }
  };

  const purgar = async () => {
    setPurgando(true);
    try {
      const r = await purgarAuditoria();
      mostrarAviso(`Purga completada: ${(r.borrados ?? 0).toLocaleString("es-PE")} registros borrados · quedó registrada`);
      refrescar();
    } catch (err) {
      mostrarAviso(mensaje(err, "No se pudo purgar la auditoría."));
    } finally {
      setPurgando(false);
    }
  };

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-xs text-content-muted">
        <Link to="/" className="transition-colors hover:text-content">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-content-secondary">Configuración</span>
      </nav>

      <div className="mb-4">
        <h1 className="text-xl font-bold text-content">Configuración</h1>
        <p className="mt-0.5 text-xs text-content-muted">
          Parámetros operativos del sistema, retención de la auditoría y entorno del servidor. Solo Administrador.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2.5 text-xs text-content-secondary"
        >
          <IconInfo size={14} className="shrink-0 text-rose-600" />
          <span>No se pudo conectar con la API de configuración.</span>
          <button
            type="button"
            onClick={refrescar}
            className="ml-auto rounded-md border border-border px-2.5 py-1 font-medium text-content transition-colors hover:bg-surface-secondary"
          >
            Reintentar
          </button>
        </div>
      )}

      <section aria-labelledby="titulo-parametros" className="mb-4">
        <h2 id="titulo-parametros" className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-content-secondary">
          Parámetros del sistema
        </h2>
        {config ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {config.parametros.map((p) => (
              <TarjetaParametro
                key={`${p.clave}-${p.valor}`}
                parametro={p}
                guardando={guardando === p.clave}
                onGuardar={guardar}
              />
            ))}
          </div>
        ) : (
          !error && <p className="py-6 text-center text-sm text-content-muted">Cargando configuración…</p>
        )}
        <p className="mt-2 text-[11px] text-content-muted">
          Solo aparecen parámetros que el sistema usa de verdad. Cada cambio queda en la auditoría con el valor anterior y el
          nuevo.
        </p>
      </section>

      <div className="mb-4">
        <PanelRetencion retencion={retencion} purgando={purgando} onPurgar={purgar} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HistorialCambios cambios={historial} />
        {config && <PanelEntorno entorno={config.entorno} />}
      </div>

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
