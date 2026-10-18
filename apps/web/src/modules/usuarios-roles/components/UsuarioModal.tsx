import { useEffect, useState } from "react";
import { ROLE_LABELS } from "@/types/auth";
import ExpandModal from "@/components/ui/ExpandModal";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { AccionUsuario, ActividadUsuario, TabUsuario, UsuarioAdmin } from "../types";
import { TABS, COLOR_ESTADO, ETIQUETA_ESTADO, SIMBOLO_ESTADO } from "../schemas/usuarios.schema";
import { obtenerActividad } from "../services/usuarios.service";
import MatrizPermisos from "./MatrizPermisos";

interface UsuarioModalProps {
  usuario: UsuarioAdmin;
  puedeAdministrar: boolean;
  onAccion: (usuario: UsuarioAdmin, accion: AccionUsuario) => void;
  onCerrar: () => void;
}

/** Vista ampliada de una cuenta con pestañas: Datos, Roles y permisos, Actividad. */
export default function UsuarioModal({ usuario, puedeAdministrar, onAccion, onCerrar }: UsuarioModalProps) {
  const [tab, setTab] = useState<TabUsuario>("datos");
  const [actividad, setActividad] = useState<ActividadUsuario[] | null>(null);

  useEffect(() => {
    let vivo = true;
    if (tab === "actividad" && actividad === null) {
      obtenerActividad(usuario.id).then((a) => {
        if (vivo) setActividad(a);
      });
    }
    return () => {
      vivo = false;
    };
  }, [tab, actividad, usuario.id]);

  const acciones: { accion: AccionUsuario; label: string }[] = [];
  if (usuario.estado === "pendiente") acciones.push({ accion: "aprobar", label: "Aprobar y asignar rol" });
  if (usuario.estado !== "pendiente") acciones.push({ accion: "cambiar-rol", label: "Cambiar rol" });
  if (usuario.estado === "activo") acciones.push({ accion: "suspender", label: "Suspender" });
  if (usuario.estado === "suspendido") acciones.push({ accion: "reactivar", label: "Reactivar" });

  const pie = (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-content-muted">
          Fuente: Usuarios y roles · ID: <span className="font-mono">{usuario.id}</span>
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {puedeAdministrar ? (
          <>
            {acciones.map((a) => (
              <button
                key={a.accion}
                type="button"
                onClick={() => onAccion(usuario, a.accion)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  a.accion === "suspender"
                    ? "border border-border text-content-secondary hover:bg-surface-tertiary"
                    : "bg-accent-600 text-white hover:bg-accent-500"
                }`}
              >
                {a.label}
              </button>
            ))}
          </>
        ) : (
          <span className="text-content-muted">Solo lectura: tu rol no permite modificar cuentas.</span>
        )}
      </div>
    </div>
  );

  return (
    <ExpandModal title={`Usuario · ${usuario.nombre}`} onClose={onCerrar} footer={pie}>
      {/* Encabezado con estado */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div>
          <h3 className="text-base font-bold text-content">{usuario.nombre}</h3>
          <p className="text-xs text-content-secondary">{usuario.correo}</p>
        </div>
        <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${COLOR_ESTADO[usuario.estado]}`}>
          <span aria-hidden="true">{SIMBOLO_ESTADO[usuario.estado]}</span>
          {ETIQUETA_ESTADO[usuario.estado]}
        </span>
      </div>

      {/* Pestañas */}
      <div role="tablist" aria-label="Secciones del usuario" className="mb-3 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={tab === t.value}
            aria-controls={`panel-usuario-${t.value}`}
            onClick={() => setTab(t.value)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              tab === t.value ? "border-accent-600 text-accent-600" : "border-transparent text-content-secondary hover:text-content"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "datos" && (
        <dl id="panel-usuario-datos" role="tabpanel" className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Dato etiqueta="Nombre completo" valor={usuario.nombre} />
          <Dato etiqueta="Correo" valor={usuario.correo} />
          <Dato etiqueta="Roles" valor={usuario.roles.length ? usuario.roles.map((r) => ROLE_LABELS[r]).join(", ") : "Sin rol"} />
          <Dato etiqueta="Estado" valor={ETIQUETA_ESTADO[usuario.estado]} />
          <Dato etiqueta="MFA (TOTP)" valor={usuario.mfa ? "Activado" : "No activado"} />
          <Dato etiqueta="Último acceso (UTC-5)" valor={usuario.ultimoAccesoUtc ? fmtDateTimeUTC5(usuario.ultimoAccesoUtc) : "Nunca"} />
          <Dato etiqueta="Fecha de alta (UTC-5)" valor={fmtDateTimeUTC5(usuario.creadoUtc)} />
          <Dato etiqueta="Aprobado por" valor={usuario.aprobadoPor ?? "—"} />
        </dl>
      )}

      {tab === "roles" && (
        <div id="panel-usuario-roles" role="tabpanel">
          <p className="mb-2 text-xs text-content-secondary">
            Rol(es) actual(es): <b className="text-content">{usuario.roles.length ? usuario.roles.map((r) => ROLE_LABELS[r]).join(", ") : "Sin rol"}</b>.
            El acceso se controla por función; los módulos sin permiso quedan ocultos y responden 403 en la API.
          </p>
          <MatrizPermisos resaltar={usuario.roles[0] ?? null} />
        </div>
      )}

      {tab === "actividad" && (
        <div id="panel-usuario-actividad" role="tabpanel">
          {actividad === null ? (
            <p className="py-8 text-center text-sm text-content-muted">Cargando actividad…</p>
          ) : actividad.length === 0 ? (
            <p className="py-8 text-center text-sm text-content-muted">Sin actividad registrada.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {actividad.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
                  <span className="w-40 text-content-muted">{fmtDateTimeUTC5(a.horaUtc)}</span>
                  <span className="font-medium text-content">{a.accion}</span>
                  <span className="text-content-secondary">{a.detalle}</span>
                  <span className="ml-auto font-mono text-[11px] text-content-muted">{a.ip}</span>
                  <span className={a.resultado === "fallido" ? "text-content-muted" : "text-content"}>
                    {a.resultado === "fallido" ? "✕ fallido" : "✓ ok"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-content-muted">
            Actividad reciente con fines operativos. El registro íntegro de auditoría se consulta en el módulo Auditoría.
          </p>
        </div>
      )}
    </ExpandModal>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col border-b border-border py-1.5">
      <dt className="text-[11px] uppercase tracking-wide text-content-muted">{etiqueta}</dt>
      <dd className="text-content">{valor}</dd>
    </div>
  );
}
