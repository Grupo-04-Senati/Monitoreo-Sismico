import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAuth } from "@/app/auth/AuthContext";
import { ApiError } from "@/lib/api";
import { downloadFile } from "@/lib/export";
import { fmtDateTimeUTC5 } from "@/lib/format";
import { IconAudit, IconCheck, IconDownload, IconInfo } from "@/components/ui/Icons";
import type { Facetas, FiltrosAuditoria as Filtros, PaginaAuditoria, RegistroAuditoria } from "./types";
import { FILTROS_VACIOS } from "./schemas/auditoria.schema";
import { exportarAuditoria, listarAuditoria, obtenerFacetas } from "./services/auditoria.service";
import FiltrosAuditoria from "./components/FiltrosAuditoria";
import TablaAuditoria from "./components/TablaAuditoria";
import DetalleRegistroModal from "./components/DetalleRegistroModal";

const TAMANO = 25;
const CLAVES = Object.keys(FILTROS_VACIOS) as (keyof Filtros)[];

export default function AuditoriaPage() {
  const { canAccess } = useAuth();
  const puedeConfigurar = canAccess("configuracion");
  const [params, setParams] = useSearchParams();
  const filtros = Object.fromEntries(CLAVES.map((k) => [k, params.get(k) ?? ""])) as unknown as Filtros;
  const clave = CLAVES.map((k) => filtros[k]).join("|");

  // El id se escribe a mano: se consulta tras una breve pausa, no en cada tecla.
  const [claveAplicada, setClaveAplicada] = useState(clave);
  useEffect(() => {
    const t = setTimeout(() => setClaveAplicada(clave), 350);
    return () => clearTimeout(t);
  }, [clave]);

  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<PaginaAuditoria | null>(null);
  const [facetas, setFacetas] = useState<Facetas | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [seleccionado, setSeleccionado] = useState<RegistroAuditoria | null>(null);
  const [exportando, setExportando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    obtenerFacetas().then(setFacetas).catch(() => setFacetas(null));
  }, [nonce]);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(false);
    listarAuditoria(filtros, pagina, TAMANO)
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
    // `claveAplicada` resume los filtros (el objeto se recrea en cada render).
  }, [claveAplicada, pagina, nonce]);

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    setTimeout(() => setAviso(null), 3600);
  }, []);

  const cambiar = (patch: Partial<Filtros>) => {
    const siguiente = { ...filtros, ...patch };
    const p = new URLSearchParams();
    CLAVES.forEach((k) => {
      if (siguiente[k]) p.set(k, siguiente[k]);
    });
    setParams(p, { replace: true });
    setPagina(1);
  };

  const exportar = async () => {
    setExportando(true);
    try {
      const csv = await exportarAuditoria(filtros);
      const sello = new Date().toISOString().slice(0, 16).replace(/\D/g, "");
      downloadFile(`auditoria_${sello}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
      mostrarAviso("Exportación descargada · quedó registrada en la auditoría");
      setNonce((n) => n + 1);
    } catch (err) {
      mostrarAviso(err instanceof ApiError && err.detail ? err.detail : "No se pudo exportar la auditoría.");
    } finally {
      setExportando(false);
    }
  };

  const filtrado = CLAVES.some((k) => filtros[k]);
  const total = datos?.total ?? 0;

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-xs text-content-muted">
        <Link to="/" className="transition-colors hover:text-content">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-content-secondary">Auditoría</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Auditoría</h1>
          <p className="mt-0.5 text-xs text-content-muted">Quién hizo qué, sobre qué y cuándo, con el antes y el después.</p>
        </div>
        <button
          type="button"
          onClick={exportar}
          disabled={exportando || total === 0}
          title={total > 50000 ? "Se exportan los 50 000 más recientes" : undefined}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconDownload size={13} />
          {exportando ? "Exportando…" : `Exportar CSV (${Math.min(total, 50000).toLocaleString("es-PE")})`}
        </button>
      </div>

      <div
        role="note"
        className="mb-3 flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-slate-500 bg-surface px-3.5 py-2.5 text-[11px] leading-relaxed text-content-secondary"
      >
        <IconAudit size={14} className="mt-0.5 shrink-0 text-content-muted" />
        <span>
          <b className="font-semibold text-content">Historial protegido.</b> La base de datos impide editar o borrar registros;
          solo una purga de retención, manual y auditada, elimina los más antiguos que{" "}
          {puedeConfigurar ? <Link to="/configuracion" className="underline">el plazo configurado</Link> : "el plazo configurado"}{" "}
          (nunca los de menos de 365 días). Exportar también queda registrado. Fechas en UTC-5; el CSV va en UTC.
          {facetas && (
            <>
              {" "}
              Total: <b className="font-medium text-content">{facetas.total.toLocaleString("es-PE")}</b> registros
              {facetas.mas_antiguo ? `, desde el ${fmtDateTimeUTC5(facetas.mas_antiguo)}` : ""}.
            </>
          )}
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2.5 text-xs text-content-secondary"
        >
          <IconInfo size={14} className="shrink-0 text-rose-600" />
          <span>No se pudo conectar con la API de auditoría.</span>
          <button
            type="button"
            onClick={() => setNonce((n) => n + 1)}
            className="ml-auto rounded-md border border-border px-2.5 py-1 font-medium text-content transition-colors hover:bg-surface-secondary"
          >
            Reintentar
          </button>
        </div>
      )}

      <FiltrosAuditoria filtros={filtros} facetas={facetas} onCambiar={cambiar} />

      <TablaAuditoria datos={datos} cargando={cargando} filtrado={filtrado} onAbrir={setSeleccionado} onPagina={setPagina} />

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-content-muted">
        <IconInfo size={12} />
        Consultar y exportar: Administrador o Auditor · ◆ acciones de seguridad o sobre la propia auditoría · La IP no se
        registra (minimización de datos)
      </p>

      {seleccionado && (
        <DetalleRegistroModal
          registro={seleccionado}
          onFiltrarEntidad={(r) => {
            setSeleccionado(null);
            cambiar({ ...FILTROS_VACIOS, entity_type: r.entity_type, entity_id: r.entity_id ?? "" });
          }}
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
