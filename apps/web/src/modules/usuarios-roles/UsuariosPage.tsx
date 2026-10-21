import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@/app/auth/AuthContext";
import { ROLE_LABELS, type Role } from "@/types/auth";
import { fmtTimeUTC5 } from "@/lib/format";
import { copyText } from "@/lib/export";
import { useUsuariosURL } from "./hooks/useUsuariosURL";
import type { AccionUsuario, ConteoRol, ResumenUsuarios, UsuarioAdmin } from "./types";
import type { IdKpiUsuario } from "./kpis";
import { KPIS } from "./kpis";
import {
  PARTES_EXPORT,
  aprobarUsuario,
  cargarContextoExport,
  cargarProcedencia,
  cargarResumen,
  cambiarRolUsuario,
  contarUsuariosPorRol,
  exportarPartes,
  listarTodos,
  listarUsuarios,
  matrizPermisos,
  obtenerUsuario,
  reactivarUsuario,
  suspenderUsuario,
  textoPartes,
  usuariosDelRol,
  type FormatoExport,
  type ParteExportId,
  type ProcedenciaUsuarios,
} from "./services/usuarios.service";
import AvisoRoles from "./components/AvisoRoles";
import TarjetasUsuarios from "./components/TarjetasUsuarios";
import GraficoUsuariosPorRol from "./components/GraficoUsuariosPorRol";
import MatrizPermisos from "./components/MatrizPermisos";
import FiltrosUsuarios from "./components/FiltrosUsuarios";
import TablaUsuarios from "./components/TablaUsuarios";
import UsuarioModal from "./components/UsuarioModal";
import ModalAccion from "./components/ModalAccion";
import ModalListaUsuarios from "./components/ModalListaUsuarios";
import ModalExportar from "./components/ModalExportar";
import ExpandModal from "@/components/ui/ExpandModal";
import { IconCheck, IconClock, IconDownload } from "@/components/ui/Icons";

const TODAS: ParteExportId[] = PARTES_EXPORT.map((p) => p.id);

interface Lista {
  titulo: string;
  descripcion?: string;
  usuarios: UsuarioAdmin[];
}

export default function UsuariosPage() {
  const { user, canAccess } = useAuth();
  const { filtros, pagina, tamano, chips, setFiltros, quitarChip, irAPagina, setTamano, limpiar } = useUsuariosURL();

  const [resumen, setResumen] = useState<ResumenUsuarios | null>(null);
  const [conteos, setConteos] = useState<ConteoRol[] | null>(null);
  const [datos, setDatos] = useState<Awaited<ReturnType<typeof listarUsuarios>> | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const reintentar = useCallback(() => { setError(null); setIntento((n) => n + 1); }, []);

  const [usuarioSel, setUsuarioSel] = useState<UsuarioAdmin | null>(null);
  const [accion, setAccion] = useState<{ usuario: UsuarioAdmin; accion: AccionUsuario } | null>(null);
  const [lista, setLista] = useState<Lista | null>(null);
  const [matriz, setMatriz] = useState(false);
  const [exportarIniciales, setExportarIniciales] = useState<ParteExportId[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [procedencia, setProcedencia] = useState<ProcedenciaUsuarios | null>(null);
  const actTime = fmtTimeUTC5(new Date().toISOString());
  const puedeAdministrar = user?.role === "admin";
  const puedeExportar = canAccess("usuarios");
  const filasMatriz = useMemo(() => matrizPermisos(), []);

  useEffect(() => {
    cargarResumen().then(setResumen).catch(() => setResumen(null));
    contarUsuariosPorRol().then(setConteos).catch(() => setConteos(null));
    cargarProcedencia().then(setProcedencia).catch(() => setProcedencia(null));
  }, []);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    listarUsuarios(filtros, pagina, tamano)
      .then((d) => {
        if (vivo) {
          setDatos(d);
          setCargando(false);
        }
      })
      .catch((e) => {
        if (vivo) {
          setDatos(null);
          setCargando(false);
          setError((e as { detail?: string; message?: string })?.detail ?? (e as Error)?.message ?? "No se pudieron cargar los usuarios.");
        }
      });
    return () => {
      vivo = false;
    };
  }, [filtros, pagina, tamano, intento]);

  const abrirLista = useCallback((nueva: Lista) => {
    setUsuarioSel(null);
    setMatriz(false);
    setLista(nueva);
  }, []);

  const abrirKpi = useCallback(
    async (id: IdKpiUsuario) => {
      const def = KPIS.find((k) => k.id === id);
      const todos = await listarTodos({ estado: "", rol: "", q: "", ultimoAcceso: "", orden: "recientes" });
      const usuarios =
        id === "pendientes"
          ? todos.filter((u) => u.estado === "pendiente")
          : id === "activos"
            ? todos.filter((u) => u.estado === "activo")
            : id === "mfa"
              ? todos.filter((u) => u.mfa)
              : todos;
      abrirLista({ titulo: def?.etiqueta ?? "Usuarios", descripcion: def?.descripcion, usuarios });
    },
    [abrirLista],
  );

  const abrirRol = useCallback(
    async (rol: Role) => {
      const usuarios = await usuariosDelRol(rol);
      abrirLista({ titulo: `Usuarios con rol ${ROLE_LABELS[rol]}`, usuarios });
    },
    [abrirLista],
  );

  const confirmarAccion = useCallback(
    async (roles: Role[]) => {
      if (!accion) return;
      const { usuario, accion: tipo } = accion;
      const fn =
        tipo === "aprobar"
          ? aprobarUsuario(usuario, roles)
          : tipo === "cambiar-rol"
            ? cambiarRolUsuario(usuario, roles)
            : tipo === "suspender"
              ? suspenderUsuario(usuario)
              : reactivarUsuario(usuario);
      const res = await fn;
      setAccion(null);
      await Promise.all([
        cargarResumen().then(setResumen),
        contarUsuariosPorRol().then(setConteos),
        listarUsuarios(filtros, pagina, tamano).then(setDatos),
      ]);
      if (usuarioSel && usuarioSel.id === usuario.id) {
        setUsuarioSel(await obtenerUsuario(usuario.id));
      }
      setAviso(`${res.mensaje} · registrado en Auditoría`);
      setTimeout(() => setAviso(null), 3200);
    },
    [accion, filtros, pagina, tamano, usuarioSel],
  );

  return (
    <div>
      {/* Encabezado */}
      <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-xs text-content-muted">
        <Link to="/" className="transition-colors hover:text-content">
          Inicio
        </Link>
        <span aria-hidden="true">/</span>
        <span>Administración</span>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-content-secondary">Usuarios y roles</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-content">Usuarios y roles</h1>
          <p className="mt-0.5 text-xs text-content-muted">
            Altas, aprobación, roles y estado de las cuentas. El acceso se controla por función.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-content-muted">
            <IconClock size={14} />
            Actualizado: <b className="font-medium text-content-secondary">{actTime}</b> (UTC-5)
          </span>
          <button
            type="button"
            onClick={() => setExportarIniciales(TODAS)}
            disabled={!puedeExportar}
            title={puedeExportar ? "Exportar por partes en CSV o Excel" : "Tu rol no permite exportar"}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconDownload size={14} />
            Exportar
          </button>
        </div>
      </div>

      {/* Aviso fijo */}
      <AvisoRoles />

      {/* KPIs clicables */}
      {resumen ? (
        <TarjetasUsuarios resumen={resumen} onAbrir={abrirKpi} />
      ) : (
        <div className="mb-3 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
      )}

      {/* Gráfico + catálogo de roles */}
      <div className="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {conteos ? (
            <GraficoUsuariosPorRol conteos={conteos} onRol={abrirRol} onMatriz={() => setMatriz(true)} />
          ) : (
            <div className="h-64 animate-pulse rounded-lg border border-border bg-surface" />
          )}
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold text-content">Roles del sistema</h3>
          <ul className="flex flex-col gap-2">
            {(["admin", "analyst", "alert_operator", "auditor", "viewer"] as Role[]).map((r) => (
              <li key={r} className="flex flex-col border-b border-border pb-2 last:border-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => abrirRol(r)}
                  className="text-left text-xs font-medium text-accent-600 hover:underline"
                >
                  {ROLE_LABELS[r]}
                </button>
                <span className="text-[11px] leading-relaxed text-content-muted">{DESCRIPCION_ROL[r]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Filtros */}
      <FiltrosUsuarios filtros={filtros} tamano={tamano} onFiltros={setFiltros} onTamano={setTamano} onLimpiar={limpiar} />

      {/* Chips */}
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

      {/* Tabla */}
      {error ? (
        <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center">
          <p className="text-sm font-semibold text-content">No se pudo conectar con el backend</p>
          <p className="mt-1 text-xs text-content-muted">{error}</p>
          <button type="button" onClick={reintentar} className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-content hover:bg-surface-muted">
            Reintentar
          </button>
        </div>
      ) : (
        <TablaUsuarios datos={datos} cargando={cargando} onAbrir={setUsuarioSel} onPagina={irAPagina} />
      )}

      {/* Pie */}
      <p className="mt-3 text-[11px] text-content-muted">
        Fuente: Usuarios y roles · Actividad registrada en Auditoría · n = {procedencia?.total ?? resumen?.total ?? "—"} cuentas · Actualizado:{" "}
        {procedencia?.actualizado ?? actTime} (UTC-5)
      </p>

      {/* Modal de usuario */}
      {usuarioSel && (
        <UsuarioModal
          usuario={usuarioSel}
          puedeAdministrar={puedeAdministrar}
          onAccion={(u, a) => setAccion({ usuario: u, accion: a })}
          onCerrar={() => setUsuarioSel(null)}
        />
      )}

      {/* Confirmación de acción */}
      {accion && (
        <ModalAccion
          usuario={accion.usuario}
          accion={accion.accion}
          onConfirmar={confirmarAccion}
          onCerrar={() => setAccion(null)}
        />
      )}

      {/* Lista de un KPI o de un rol */}
      {lista && (
        <ModalListaUsuarios
          titulo={lista.titulo}
          descripcion={lista.descripcion}
          usuarios={lista.usuarios}
          onAbrir={(u) => setUsuarioSel(u)}
          onCerrar={() => setLista(null)}
        />
      )}

      {/* Matriz de permisos */}
      {matriz && (
        <ExpandModal title="Matriz de permisos (módulo × rol)" onClose={() => setMatriz(false)}>
          <p className="mb-3 text-xs text-content-secondary">
            Nivel de acceso de cada rol sobre cada módulo. Los módulos sin permiso quedan ocultos en el menú y responden
            403 en la API aunque se llame directamente.
          </p>
          <MatrizPermisos />
        </ExpandModal>
      )}

      {/* Exportación por partes */}
      {exportarIniciales && (
        <ModalExportar
          iniciales={exportarIniciales}
          onCerrar={() => setExportarIniciales(null)}
          onDescargar={async (ids: ParteExportId[], formato: FormatoExport) => {
            const contexto = await cargarContextoExport(filtros);
            exportarPartes(ids, formato, contexto);
            setExportarIniciales(null);
          }}
          onCopiar={async (ids: ParteExportId[]) => {
            const contexto = await cargarContextoExport(filtros);
            return copyText(textoPartes(ids, contexto));
          }}
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

const DESCRIPCION_ROL: Record<Role, string> = {
  admin: "Control total: usuarios, roles y configuración.",
  analyst: "Análisis de datos, modelos y reportes.",
  alert_operator: "Reglas de alerta y centro de alertas.",
  auditor: "Consulta y auditoría sin operación.",
  viewer: "Acceso de consulta al monitoreo.",
};
