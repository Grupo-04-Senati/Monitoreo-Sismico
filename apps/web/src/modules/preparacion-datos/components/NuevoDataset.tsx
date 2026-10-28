import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { IconDatabase, IconInfo } from "@/components/ui/Icons";
import type { FuenteOpcion, NuevoDataset as Formulario, TipoMagnitudPermitido, Variable, ZonaDataset } from "../types";
import { REGION_OPTIONS } from "@/lib/catalogo";
import {
  OPCIONES_DUPLICADOS,
  OPCIONES_PROFUNDIDAD,
  TIPOS_MAGNITUD,
  VARIABLES,
  formularioInicial,
  validarFormulario,
} from "../schemas/datasets.schema";

const campoCls =
  "rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none";
const etiquetaCls = "text-[11px] font-medium text-content-secondary";

interface NuevoDatasetProps {
  puedeCrear: boolean;
  fuentes: FuenteOpcion[];
  /** Periodo por defecto: rango real del catálogo. */
  desdeInicial: string;
  hastaInicial: string;
  creando: boolean;
  /** Error devuelto por la API al crear (p. ej. "no queda ningún evento"). */
  errorApi: string | null;
  onCrear: (formulario: Formulario) => void;
}

/** Formulario de creación de un dataset: periodo, reglas, variables y partición. */
export default function NuevoDataset({
  puedeCrear,
  fuentes,
  desdeInicial,
  hastaInicial,
  creando,
  errorApi,
  onCrear,
}: NuevoDatasetProps) {
  const [f, setF] = useState<Formulario>(() => formularioInicial(desdeInicial, hastaInicial));
  const [intentado, setIntentado] = useState(false);

  // El rango del catálogo llega de /meta después del primer render.
  useEffect(() => {
    setF((actual) => ({
      ...actual,
      desde: actual.desde || desdeInicial,
      hasta: actual.hasta || hastaInicial,
    }));
  }, [desdeInicial, hastaInicial]);

  const problema = validarFormulario(f);
  const set = (patch: Partial<Formulario>) => setF((p) => ({ ...p, ...patch }));
  const setReglas = (patch: Partial<Formulario["reglas"]>) => setF((p) => ({ ...p, reglas: { ...p.reglas, ...patch } }));
  const setZona = (patch: Partial<ZonaDataset>) => setF((p) => ({ ...p, zona: { ...p.zona, ...patch } }));
  const numeroZona = (texto: string): number | null => {
    const t = texto.trim().replace(",", ".");
    return t === "" || Number.isNaN(Number(t)) ? null : Number(t);
  };
  const alternarDepto = (nombre: string) =>
    setZona({
      departamentos: f.zona.departamentos.includes(nombre)
        ? f.zona.departamentos.filter((d) => d !== nombre)
        : [...f.zona.departamentos, nombre],
    });

  const alternarVariable = (v: Variable) =>
    set({ variables: f.variables.includes(v) ? f.variables.filter((x) => x !== v) : [...f.variables, v] });

  const filtrarTipos = f.reglas.tipos_magnitud !== null;
  const alternarTipo = (t: TipoMagnitudPermitido) => {
    const actuales = f.reglas.tipos_magnitud ?? [];
    setReglas({ tipos_magnitud: actuales.includes(t) ? actuales.filter((x) => x !== t) : [...actuales, t] });
  };

  const enviar = () => {
    setIntentado(true);
    if (problema || !puedeCrear) return;
    onCrear({ ...f, name: f.name.trim(), description: f.description?.trim() || null });
  };

  return (
    <Card
      title="Nuevo dataset"
      help="Elige el periodo, las reglas de limpieza, las variables y la fecha de corte. El informe de calidad se calcula al crearlo."
    >
      {!puedeCrear && (
        <p role="note" className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-[11px] text-content-secondary">
          <IconInfo size={13} className="mt-0.5 shrink-0" />
          Tu rol puede consultar datasets, pero no crearlos.
        </p>
      )}

      <fieldset disabled={!puedeCrear || creando} className="space-y-4">
        {/* Identificación y periodo */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className={etiquetaCls}>Nombre</span>
            <input
              value={f.name}
              onChange={(e) => set({ name: e.target.value })}
              maxLength={120}
              placeholder="p. ej. sismos_m45_2000_2026"
              className={campoCls}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={etiquetaCls}>Fuente</span>
            <select value={f.fuente ?? ""} onChange={(e) => set({ fuente: e.target.value || null })} className={campoCls}>
              <option value="">Todas las fuentes</option>
              {fuentes.map((s) => (
                <option key={s.key} value={s.key}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={etiquetaCls}>Desde (UTC)</span>
            <input type="date" value={f.desde} onChange={(e) => set({ desde: e.target.value })} className={campoCls} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={etiquetaCls}>Hasta (UTC, incluido)</span>
            <input type="date" value={f.hasta} onChange={(e) => set({ hasta: e.target.value })} className={campoCls} />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className={etiquetaCls}>Descripción (opcional)</span>
          <input
            value={f.description ?? ""}
            onChange={(e) => set({ description: e.target.value })}
            maxLength={500}
            placeholder="Para qué se usará este dataset"
            className={campoCls}
          />
        </label>

        {/* Zona (sector) del dataset (D32) */}
        <div>
          <p className="mb-1 text-xs font-semibold text-content">Zona del análisis</p>
          <p className="mb-2 text-[11px] text-content-muted">
            Limita el dataset al sector que le importa a la empresa (una mina, una obra, un terreno). La estimación del modelo
            contará en esa misma zona.
          </p>
          <div className="mb-2 inline-flex overflow-hidden rounded-md border border-border" role="group" aria-label="Tipo de zona">
            {(
              [
                ["todo", "Toda la cobertura"],
                ["departamentos", "Departamentos"],
                ["circulo", "Radio alrededor de un punto"],
              ] as const
            ).map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={f.zona.tipo === valor}
                onClick={() => setZona({ tipo: valor })}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  f.zona.tipo === valor ? "bg-accent-600 text-white" : "bg-surface text-content-secondary hover:bg-surface-tertiary"
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          {f.zona.tipo === "departamentos" && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4 lg:grid-cols-5">
              {REGION_OPTIONS.map((r) => (
                <label key={r.slug} className="flex items-center gap-1.5 text-xs text-content">
                  <input type="checkbox" checked={f.zona.departamentos.includes(r.name)} onChange={() => alternarDepto(r.name)} />
                  {r.name}
                </label>
              ))}
            </div>
          )}
          {f.zona.tipo === "circulo" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1">
                <span className={etiquetaCls}>Nombre del lugar</span>
                <input value={f.zona.nombre ?? ""} onChange={(e) => setZona({ nombre: e.target.value || null })} placeholder="p. ej. Mina Arequipa" maxLength={120} className={campoCls} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={etiquetaCls}>Latitud del centro</span>
                <input inputMode="decimal" defaultValue={f.zona.lat ?? ""} onChange={(e) => setZona({ lat: numeroZona(e.target.value) })} placeholder="-16.40" className={campoCls} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={etiquetaCls}>Longitud del centro</span>
                <input inputMode="decimal" defaultValue={f.zona.lon ?? ""} onChange={(e) => setZona({ lon: numeroZona(e.target.value) })} placeholder="-71.50" className={campoCls} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={etiquetaCls}>Radio (km)</span>
                <input inputMode="decimal" defaultValue={f.zona.radio_km ?? ""} onChange={(e) => setZona({ radio_km: numeroZona(e.target.value) })} placeholder="200" className={campoCls} />
              </label>
            </div>
          )}
        </div>

        {/* Reglas de limpieza */}
        <div>
          <p className="mb-2 text-xs font-semibold text-content">Reglas de limpieza</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span className={etiquetaCls}>Magnitud mínima (completitud)</span>
              <input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={f.reglas.magnitud_minima ?? ""}
                onChange={(e) => setReglas({ magnitud_minima: e.target.value === "" ? null : Number(e.target.value) })}
                placeholder="Sin mínimo"
                className={campoCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={etiquetaCls}>Eventos sin profundidad</span>
              <select
                value={f.reglas.sin_profundidad}
                onChange={(e) => setReglas({ sin_profundidad: e.target.value as Formulario["reglas"]["sin_profundidad"] })}
                className={campoCls}
              >
                {OPCIONES_PROFUNDIDAD.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className={etiquetaCls}>Posibles duplicados (&lt; 60 s y &lt; 50 km)</span>
              <select
                value={f.reglas.posibles_duplicados}
                onChange={(e) => setReglas({ posibles_duplicados: e.target.value as Formulario["reglas"]["posibles_duplicados"] })}
                className={campoCls}
              >
                {OPCIONES_DUPLICADOS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-2 pt-4">
              <label className="flex items-center gap-2 text-xs text-content">
                <input
                  type="checkbox"
                  checked={f.reglas.solo_revisados}
                  onChange={(e) => setReglas({ solo_revisados: e.target.checked })}
                />
                Solo eventos revisados por la fuente
              </label>
              <label className="flex items-center gap-2 text-xs text-content">
                <input
                  type="checkbox"
                  checked={filtrarTipos}
                  onChange={(e) => setReglas({ tipos_magnitud: e.target.checked ? ["Mw", "mb"] : null })}
                />
                Filtrar por tipo de magnitud
              </label>
            </div>
          </div>
          {filtrarTipos && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-content" role="group" aria-label="Tipos de magnitud permitidos">
              <span className={etiquetaCls}>Tipos permitidos:</span>
              {TIPOS_MAGNITUD.map((t) => (
                <label key={t} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={f.reglas.tipos_magnitud?.includes(t) ?? false} onChange={() => alternarTipo(t)} />
                  {t}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Variables, objetivo y partición */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2" role="group" aria-label="Variables del dataset">
            <p className={`${etiquetaCls} mb-1.5`}>Variables</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {VARIABLES.map((v) => (
                <label key={v.value} className="flex items-center gap-1.5 text-xs text-content">
                  <input
                    type="checkbox"
                    checked={f.variables.includes(v.value)}
                    disabled={f.variable_objetivo === v.value}
                    onChange={() => alternarVariable(v.value)}
                  />
                  {v.label}
                </label>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className={etiquetaCls}>Variable objetivo</span>
            <select
              value={f.variable_objetivo ?? ""}
              onChange={(e) => {
                const objetivo = (e.target.value || null) as Variable | null;
                set({ variable_objetivo: objetivo, variables: f.variables.filter((v) => v !== objetivo) });
              }}
              className={campoCls}
            >
              <option value="">Sin variable objetivo</option>
              {VARIABLES.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={etiquetaCls}>Fecha de corte (partición)</span>
            <input
              type="date"
              value={f.fecha_corte ?? ""}
              onChange={(e) => set({ fecha_corte: e.target.value || null })}
              className={campoCls}
            />
            <span className="text-[10px] text-content-muted">Entrenamiento antes de esta fecha; prueba desde ella.</span>
          </label>
        </div>
      </fieldset>

      {(intentado && problema) || errorApi ? (
        <p role="alert" className="mt-3 rounded-md border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2 text-[11px] text-content-secondary">
          {errorApi ?? problema}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-[11px] text-content-muted">
          Se guarda como borrador; quedará en la Auditoría.
        </span>
        <button
          type="button"
          onClick={enviar}
          disabled={!puedeCrear || creando}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconDatabase size={13} />
          {creando ? "Preparando…" : "Crear dataset"}
        </button>
      </div>
    </Card>
  );
}
