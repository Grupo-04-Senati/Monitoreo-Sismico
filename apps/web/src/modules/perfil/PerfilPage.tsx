import { useEffect, useState } from "react";
import { useAuth } from "@/app/auth/AuthContext";
import { ROLE_LABELS } from "@/types/auth";
import { ApiError, apiDelete, apiGet, apiPost } from "@/lib/api";
import { fmtDateTimeUTC5 } from "@/lib/format";
import { IconInfo } from "@/components/ui/Icons";

/** Estado del celular del usuario (`GET /me/telefono`, D31). */
interface EstadoTelefono {
  telefono: string | null;
  verificado: boolean;
  verificado_at: string | null;
  consentimiento_at: string | null;
  codigo_pendiente: boolean;
  sms_configurado: boolean;
  simulado?: boolean;
  /** Solo en la demo sin Twilio: el código, para poder completar el flujo. */
  codigo_demo?: string;
}

const campoCls =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-content focus:border-accent-500 focus:outline-none";
const btnPrimario =
  "inline-flex items-center rounded-md bg-accent-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:opacity-40";
const btnSecundario =
  "inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-tertiary disabled:opacity-40";

const TEXTO_CONSENTIMIENTO =
  "Acepto que la empresa use este número solo para enviarme avisos internos de sismos de Sismora. Puedo darme de baja cuando quiera desde esta página.";

/**
 * Mi perfil: datos de la cuenta y el celular para avisos por SMS (D31).
 * Cada persona registra y verifica su propio número, con consentimiento explícito
 * (Ley 29733), y puede darse de baja en cualquier momento.
 */
export default function PerfilPage() {
  const { user } = useAuth();
  const [estado, setEstado] = useState<EstadoTelefono | null>(null);
  const [numero, setNumero] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [codigoDemo, setCodigoDemo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    apiGet<EstadoTelefono>("/me/telefono")
      .then(setEstado)
      .catch(() => setError("No se pudo cargar el estado del celular."));
  }, []);

  const accion = async (fn: () => Promise<EstadoTelefono>, exito: string | ((r: EstadoTelefono) => string)) => {
    setOcupado(true);
    setError(null);
    setAviso(null);
    try {
      const r = await fn();
      setEstado(r);
      setCodigoDemo(r.codigo_demo ?? null);
      setAviso(typeof exito === "function" ? exito(r) : exito);
    } catch (e) {
      setError(e instanceof ApiError && e.detail ? e.detail : "No se pudo completar la acción.");
    } finally {
      setOcupado(false);
    }
  };

  const enviarCodigo = () =>
    accion(
      () => apiPost<EstadoTelefono>("/me/telefono", { telefono: numero, consentimiento: true }),
      (r) => (r.simulado ? "Modo demostración: el SMS con el código se simuló (no salió al celular)." : "Le enviamos un código de 6 dígitos por SMS."),
    );
  const verificar = () =>
    accion(async () => {
      const r = await apiPost<EstadoTelefono>("/me/telefono/verificar", { codigo });
      setCodigo("");
      return r;
    }, "Número verificado: recibirá los avisos de las reglas que incluyan su rol.");
  const darDeBaja = () => {
    if (!window.confirm("¿Dejar de recibir avisos por SMS? Se borrará su número.")) return;
    void accion(() => apiDelete<EstadoTelefono>("/me/telefono"), "Listo: ya no recibirá avisos por SMS y su número fue borrado.");
  };

  const pendiente = estado?.codigo_pendiente && !estado.verificado;

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-content">Mi perfil</h1>
      <p className="mt-0.5 mb-4 text-xs text-content-muted">Datos de su cuenta y cómo recibe los avisos internos.</p>

      <section className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3">
        <h2 className="mb-2 text-sm font-semibold text-content">Cuenta</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-content-muted">Nombre</dt>
          <dd className="text-content">{user?.fullName ?? "—"}</dd>
          <dt className="text-content-muted">Correo</dt>
          <dd className="text-content">{user?.email ?? "—"}</dd>
          <dt className="text-content-muted">Rol</dt>
          <dd className="text-content">{user ? ROLE_LABELS[user.role] : "—"}</dd>
        </dl>
        <p className="mt-2 text-[11px] text-content-muted">El rol lo asigna un Administrador.</p>
      </section>

      <section className="rounded-[10px] border border-border bg-surface px-4 py-3">
        <h2 className="text-sm font-semibold text-content">Avisos por SMS</h2>
        <p className="mt-0.5 mb-3 text-xs text-content-secondary">
          Si una regla de aviso incluye su rol, le llegará un SMS cuando un operador apruebe el aviso. Es un aviso interno de la
          empresa: no es una alerta oficial (IGP/INDECI).
        </p>

        {estado && !estado.sms_configurado && (
          <p role="note" className="mb-3 flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface-secondary px-3 py-2 text-[11px] text-content-secondary">
            <IconInfo size={13} className="mt-0.5 shrink-0" />
            <span>
              Modo demostración: el envío de SMS no está configurado, así que los SMS se <b className="text-content">simulan</b> (quedan
              registrados, pero no salen al celular).
            </span>
          </p>
        )}

        {error && (
          <p role="alert" className="mb-3 rounded-md border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2 text-xs text-content-secondary">
            {error}
          </p>
        )}
        {aviso && !error && (
          <p role="status" className="mb-3 rounded-md border border-border border-l-2 border-l-accent-600 bg-surface px-3 py-2 text-xs text-content-secondary">
            {aviso}
          </p>
        )}

        {!estado ? (
          <p className="text-xs text-content-muted">Cargando…</p>
        ) : estado.verificado ? (
          <div className="text-xs">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-content-muted">Celular</dt>
              <dd className="font-medium text-content">{estado.telefono}</dd>
              <dt className="text-content-muted">Verificado</dt>
              <dd className="text-content-secondary">{estado.verificado_at ? `${fmtDateTimeUTC5(estado.verificado_at)} (UTC-5)` : "—"}</dd>
              <dt className="text-content-muted">Consentimiento</dt>
              <dd className="text-content-secondary">{estado.consentimiento_at ? `${fmtDateTimeUTC5(estado.consentimiento_at)} (UTC-5)` : "—"}</dd>
            </dl>
            <button type="button" onClick={darDeBaja} disabled={ocupado} className={`${btnSecundario} mt-3`}>
              Dejar de recibir SMS (dar de baja)
            </button>
          </div>
        ) : pendiente ? (
          <div className="text-xs">
            <p className="mb-2 text-content-secondary">
              Escriba el código de 6 dígitos que enviamos a <b className="text-content">{estado.telefono}</b>. Vence en 10 minutos.
            </p>
            {codigoDemo && (
              <p className="mb-2 rounded-md bg-surface-secondary px-3 py-1.5 text-[11px] text-content-secondary">
                Demostración sin SMS real: su código es <b className="font-mono text-content">{codigoDemo}</b>.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                inputMode="numeric"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                aria-label="Código de verificación"
                className="w-32 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-sm tracking-widest text-content focus:border-accent-500 focus:outline-none"
              />
              <button type="button" onClick={verificar} disabled={ocupado || codigo.length !== 6} className={btnPrimario}>
                Verificar
              </button>
              <button type="button" onClick={() => setEstado({ ...estado, codigo_pendiente: false })} className={btnSecundario}>
                Cambiar número o reenviar
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs">
            <label className="mb-1 block text-[11px] font-medium text-content-secondary" htmlFor="celular">
              Celular
            </label>
            <input
              id="celular"
              inputMode="tel"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="+51 987 654 321"
              className={`${campoCls} max-w-xs`}
            />
            <label className="mt-3 flex items-start gap-2 text-content-secondary">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5" />
              <span>{TEXTO_CONSENTIMIENTO}</span>
            </label>
            <button type="button" onClick={enviarCodigo} disabled={ocupado || !acepta || numero.trim().length < 9} className={`${btnPrimario} mt-3`}>
              Enviar código de verificación
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
