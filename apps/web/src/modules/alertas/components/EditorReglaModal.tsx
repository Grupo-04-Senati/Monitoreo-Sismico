import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import ExpandModal from "@/components/ui/ExpandModal";
import type { Regla, ReglaIn, Severidad, TipoMagnitud } from "../types";
import {
  ETIQUETA_SEVERIDAD,
  FORM_VACIO,
  MARCADORES,
  TIPOS_MAGNITUD,
  formDesdeRegla,
  reglaDesdeForm,
  validarRegla,
  type FormRegla,
} from "../schemas/alertas.schema";
import PanelSimulacion from "./PanelSimulacion";

const campoCls =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none";
const etiquetaCls = "text-[11px] font-medium text-content-secondary";

interface EditorReglaModalProps {
  /** Regla a editar (inactiva) o null para crear una nueva. */
  regla: Regla | null;
  guardando: boolean;
  errorApi: string | null;
  onGuardar: (regla: ReglaIn) => void;
  onCerrar: () => void;
}

function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={etiquetaCls}>{etiqueta}</span>
      {children}
      {ayuda && <span className="text-[10px] text-content-muted">{ayuda}</span>}
    </label>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border border-border p-3">
      <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-content-secondary">{titulo}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** Crear o editar una regla. Siempre se guarda inactiva: la activa un Administrador. */
export default function EditorReglaModal({ regla, guardando, errorApi, onGuardar, onCerrar }: EditorReglaModalProps) {
  const [f, setF] = useState<FormRegla>(() => (regla ? formDesdeRegla(regla) : FORM_VACIO));
  const [intentado, setIntentado] = useState(false);
  const set = (patch: Partial<FormRegla>) => setF((p) => ({ ...p, ...patch }));

  const problema = validarRegla(f);
  const cuerpo = useMemo(() => (problema ? null : reglaDesdeForm(f)), [f, problema]);

  const alternarTipo = (t: TipoMagnitud) =>
    set({ tipos: f.tipos.includes(t) ? f.tipos.filter((x) => x !== t) : [...f.tipos, t] });

  const guardar = () => {
    setIntentado(true);
    if (cuerpo) onGuardar(cuerpo);
  };

  const pie = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-content-muted">
        Se guarda <b className="font-semibold text-content-secondary">inactiva</b>: un Administrador debe activarla.
      </span>
      <button
        type="button"
        onClick={onCerrar}
        className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs font-medium text-content transition-colors hover:bg-surface-tertiary"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={guardar}
        disabled={guardando}
        className="rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:opacity-40"
      >
        {guardando ? "Guardando…" : regla ? "Guardar cambios" : "Crear regla"}
      </button>
    </div>
  );

  return (
    <ExpandModal title={regla ? `Editar regla · ${regla.name}` : "Nueva regla de aviso"} onClose={onCerrar} footer={pie} resizable>
      <div className="space-y-4">
        {(intentado && problema) || errorApi ? (
          <p role="alert" className="rounded-md border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2 text-[11px] text-content-secondary">
            {errorApi ?? problema}
          </p>
        ) : null}

        <Seccion titulo="Regla">
          <Campo etiqueta="Nombre">
            <input value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} placeholder="p. ej. Mina Arequipa M4.5" className={campoCls} />
          </Campo>
          <Campo etiqueta="Severidad del aviso" ayuda="Orienta la atención del equipo; no es un nivel de peligro oficial.">
            <select value={f.severidad} onChange={(e) => set({ severidad: e.target.value as Severidad })} className={campoCls}>
              {(Object.keys(ETIQUETA_SEVERIDAD) as Severidad[]).map((s) => (
                <option key={s} value={s}>{ETIQUETA_SEVERIDAD[s]}</option>
              ))}
            </select>
          </Campo>
          <div className="sm:col-span-2">
            <Campo etiqueta="Descripción (opcional)">
              <input value={f.description} onChange={(e) => set({ description: e.target.value })} maxLength={500} placeholder="Para qué activo o equipo es" className={campoCls} />
            </Campo>
          </div>
        </Seccion>

        <Seccion titulo="Condición">
          <Campo etiqueta="Magnitud mínima">
            <input inputMode="decimal" value={f.magnitud} onChange={(e) => set({ magnitud: e.target.value })} className={campoCls} />
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo etiqueta="Prof. mínima (km)">
              <input inputMode="decimal" value={f.profMin} onChange={(e) => set({ profMin: e.target.value })} placeholder="Sin límite" className={campoCls} />
            </Campo>
            <Campo etiqueta="Prof. máxima (km)">
              <input inputMode="decimal" value={f.profMax} onChange={(e) => set({ profMax: e.target.value })} placeholder="Sin límite" className={campoCls} />
            </Campo>
          </div>
          <div className="flex flex-col gap-1">
            <span className={etiquetaCls}>Tipos de magnitud</span>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_MAGNITUD.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={f.tipos.includes(t)}
                  onClick={() => alternarTipo(t)}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    f.tipos.includes(t) ? "border-accent-500 bg-accent-600 text-white" : "border-border text-content-secondary hover:bg-surface-tertiary"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-content-muted">{f.tipos.length ? "Solo los marcados." : "Ninguno marcado = todos."}</span>
          </div>
          <label className="flex items-center gap-2 self-center text-xs text-content">
            <input type="checkbox" checked={f.soloRevisados} onChange={(e) => set({ soloRevisados: e.target.checked })} />
            Solo sismos revisados por la fuente
          </label>
        </Seccion>

        <Seccion titulo="Zona">
          <div className="flex gap-1.5 sm:col-span-2">
            {(["todo", "circulo"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={f.zonaTipo === t}
                onClick={() => set({ zonaTipo: t })}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  f.zonaTipo === t ? "border-accent-500 bg-accent-600 text-white" : "border-border text-content-secondary hover:bg-surface-tertiary"
                }`}
              >
                {t === "todo" ? "Toda la cobertura" : "Radio alrededor de un punto"}
              </button>
            ))}
          </div>
          {f.zonaTipo === "circulo" && (
            <>
              <Campo etiqueta="Nombre del lugar" ayuda="p. ej. la sede o el activo que se protege.">
                <input value={f.zonaNombre} onChange={(e) => set({ zonaNombre: e.target.value })} maxLength={80} placeholder="Mina Arequipa" className={campoCls} />
              </Campo>
              <Campo etiqueta="Radio (km)">
                <input inputMode="decimal" value={f.radio} onChange={(e) => set({ radio: e.target.value })} placeholder="150" className={campoCls} />
              </Campo>
              <Campo etiqueta="Latitud del centro" ayuda="Grados decimales; sur negativo.">
                <input inputMode="decimal" value={f.lat} onChange={(e) => set({ lat: e.target.value })} placeholder="-16.40" className={campoCls} />
              </Campo>
              <Campo etiqueta="Longitud del centro" ayuda="Grados decimales; oeste negativo.">
                <input inputMode="decimal" value={f.lon} onChange={(e) => set({ lon: e.target.value })} placeholder="-71.50" className={campoCls} />
              </Campo>
            </>
          )}
        </Seccion>

        <Seccion titulo="Entrega">
          <div className="flex flex-col gap-1.5">
            <span className={etiquetaCls}>Canales</span>
            <label className="flex items-center gap-2 text-xs text-content">
              <input type="checkbox" checked={f.app} onChange={(e) => set({ app: e.target.checked })} />
              Plataforma (Centro de alertas)
            </label>
            <label className="flex items-center gap-2 text-xs text-content">
              <input type="checkbox" checked={f.email} onChange={(e) => set({ email: e.target.checked })} />
              Correo electrónico
            </label>
          </div>
          <Campo etiqueta="Destinatarios de correo" ayuda="Separados por coma. Si el SMTP está desactivado, la entrega queda “simulada”.">
            <textarea
              value={f.destinatarios}
              onChange={(e) => set({ destinatarios: e.target.value })}
              rows={2}
              disabled={!f.email}
              placeholder="seguridad@empresa.pe, operaciones@empresa.pe"
              className={`${campoCls} disabled:opacity-50`}
            />
          </Campo>
          <Campo etiqueta="Espera entre avisos (min)" ayuda="Tras un aviso, los sismos dentro de este tiempo quedan “suprimidos”. Máx. 10080 (7 días).">
            <input inputMode="numeric" value={f.cooldown} onChange={(e) => set({ cooldown: e.target.value })} className={campoCls} />
          </Campo>
          <Campo etiqueta="Antigüedad máxima del sismo (h)" ayuda="No avisa de sismos más viejos (p. ej. al reingestar el catálogo).">
            <input inputMode="numeric" value={f.antiguedad} onChange={(e) => set({ antiguedad: e.target.value })} className={campoCls} />
          </Campo>
          <label className="flex items-start gap-2 text-xs text-content sm:col-span-2">
            <input type="checkbox" checked={f.requiereAprobacion} onChange={(e) => set({ requiereAprobacion: e.target.checked })} className="mt-0.5" />
            <span>
              Requiere aprobación antes de enviar
              <span className="block text-[10px] text-content-muted">
                Recomendado: los datos de la fuente pueden ser preliminares. Sin aprobación, el aviso se entrega en cuanto llega el sismo.
              </span>
            </span>
          </label>
        </Seccion>

        <details className="rounded-lg border border-border p-3">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-content-secondary">
            Plantillas del aviso (opcional)
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-[11px] text-content-muted">
              Vacío = plantilla por defecto, que aclara que no es una alerta oficial. Marcadores:{" "}
              {MARCADORES.map((m) => (
                <code key={m} className="mr-1 rounded bg-surface-tertiary px-1">{`{${m}}`}</code>
              ))}
            </p>
            <Campo etiqueta="Título">
              <input value={f.plantillaTitulo} onChange={(e) => set({ plantillaTitulo: e.target.value })} maxLength={200} placeholder="Sismo M{magnitud} {tipo} · {zona}" className={campoCls} />
            </Campo>
            <Campo etiqueta="Mensaje">
              <textarea value={f.plantillaMensaje} onChange={(e) => set({ plantillaMensaje: e.target.value })} maxLength={1000} rows={3} placeholder="Plantilla por defecto del servidor" className={campoCls} />
            </Campo>
          </div>
        </details>

        <PanelSimulacion regla={cuerpo} problema={problema} />
      </div>
    </ExpandModal>
  );
}
