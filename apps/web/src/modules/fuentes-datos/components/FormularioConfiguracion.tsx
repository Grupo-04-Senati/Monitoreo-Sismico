import { useEffect, useState } from "react";
import type { ConfiguracionFuente } from "../types";
import Card from "@/components/ui/Card";
import { IconCheck, IconExpand, IconShield } from "@/components/ui/Icons";

const inputCls =
  "w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

interface FormularioConfiguracionProps {
  config: ConfiguracionFuente;
  puedeEditar: boolean;
  onGuardar: (config: ConfiguracionFuente) => Promise<void>;
  onExpandir?: () => void;
}

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-content-secondary">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-content-muted">{hint}</span>}
    </label>
  );
}

/** Configuración del conector (editable solo por Administrador). */
export default function FormularioConfiguracion({ config, puedeEditar, onGuardar, onExpandir }: FormularioConfiguracionProps) {
  const [form, setForm] = useState<ConfiguracionFuente>(config);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => setForm(config), [config]);

  const set = <K extends keyof ConfiguracionFuente>(clave: K, valor: ConfiguracionFuente[K]) => {
    setForm((f) => ({ ...f, [clave]: valor }));
    setGuardado(false);
  };

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!puedeEditar) return;
    setGuardando(true);
    await onGuardar(form);
    setGuardando(false);
    setGuardado(true);
  };

  return (
    <form onSubmit={enviar}>
      <Card
        title="Configuración del conector"
        action={
          <div className="flex items-center gap-2">
            {onExpandir && (
              <button
                type="button"
                onClick={onExpandir}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-content-secondary transition-colors hover:bg-surface-tertiary"
              >
                <IconExpand size={13} />
                Pantalla completa
              </button>
            )}
            <span className="inline-flex items-center gap-1 text-[11px] text-content-muted">
              <IconShield size={12} />
              {puedeEditar ? "Editable (Administrador)" : "Solo lectura"}
            </span>
          </div>
        }
        footer="Los cambios quedan registrados en Auditoría. Las credenciales se gestionan como secretos y no se editan aquí."
      >
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <Campo label="Frecuencia (minutos)" hint="Cadencia de la ingesta programada.">
            <input
              type="number"
              min={1}
              max={1440}
              value={form.frecuenciaMin}
              disabled={!puedeEditar}
              onChange={(ev) => set("frecuenciaMin", Number(ev.target.value))}
              className={inputCls}
            />
          </Campo>
          <Campo label="URL / API">
            <input type="text" value={form.urlApi} disabled={!puedeEditar} onChange={(ev) => set("urlApi", ev.target.value)} className={inputCls} />
          </Campo>
          <Campo label="Contacto">
            <input
              type="text"
              value={form.contacto}
              disabled={!puedeEditar}
              placeholder="correo o teléfono"
              onChange={(ev) => set("contacto", ev.target.value)}
              className={inputCls}
            />
          </Campo>
          <Campo label="Licencia">
            <input
              type="text"
              value={form.licencia}
              disabled={!puedeEditar}
              placeholder="pendiente de definir"
              onChange={(ev) => set("licencia", ev.target.value)}
              className={inputCls}
            />
          </Campo>
          <Campo label="Límites de uso">
            <input
              type="text"
              value={form.limitesUso}
              disabled={!puedeEditar}
              placeholder="p. ej. 60 req/min"
              onChange={(ev) => set("limitesUso", ev.target.value)}
              className={inputCls}
            />
          </Campo>
          <Campo label="Reintentos">
            <input
              type="number"
              min={0}
              max={10}
              value={form.reintentos}
              disabled={!puedeEditar}
              onChange={(ev) => set("reintentos", Number(ev.target.value))}
              className={inputCls}
            />
          </Campo>
          <Campo label="Timeout (segundos)">
            <input
              type="number"
              min={1}
              max={300}
              value={form.timeoutSeg}
              disabled={!puedeEditar}
              onChange={(ev) => set("timeoutSeg", Number(ev.target.value))}
              className={inputCls}
            />
          </Campo>
          <label className="flex items-center gap-2 pt-5 text-xs text-content-secondary">
            <input
              type="checkbox"
              checked={form.ingestaIdempotente}
              disabled={!puedeEditar}
              onChange={(ev) => set("ingestaIdempotente", ev.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--accent-500)]"
            />
            Ingesta idempotente
          </label>
          <label className="flex items-center gap-2 pt-5 text-xs text-content-secondary">
            <input
              type="checkbox"
              checked={form.notificarErrores}
              disabled={!puedeEditar}
              onChange={(ev) => set("notificarErrores", ev.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--accent-500)]"
            />
            Notificar errores al equipo
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={!puedeEditar || guardando}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando && <IconCheck size={13} />}
            {guardando ? "Guardando…" : "Guardar cambios"}
          </button>
          {guardado && (
            <span className="inline-flex items-center gap-1 text-xs text-success" role="status">
              <IconCheck size={13} />
              Cambios guardados
            </span>
          )}
          {!puedeEditar && <span className="text-xs text-content-muted">Tu rol solo puede consultar la configuración.</span>}
        </div>
      </Card>
    </form>
  );
}
