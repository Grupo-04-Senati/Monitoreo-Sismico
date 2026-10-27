import { useEffect, useMemo, useState } from "react";
import { fmtDateTimeUTC5 } from "@/lib/format";
import { IconAlertTriangle, IconInfo } from "@/components/ui/Icons";
import PlanisferioSvg from "./PlanisferioSvg";
import {
  PERIODOS_MUNDO,
  cargarPaises,
  cargarSismosMundo,
  type PaisMundo,
  type PeriodoMundo,
  type RespuestaMundo,
  type SismoMundo,
} from "../services/mundo.service";

const MAGNITUDES = [4.5, 5, 6, 7];

const btn = (activo: boolean) =>
  `px-3 py-1.5 text-xs font-medium transition-colors ${
    activo ? "bg-accent-600 text-white" : "bg-surface text-content-secondary hover:bg-surface-tertiary"
  }`;

/**
 * Vista mundial del Mapa sísmico (D30): sismos M4.5+ del planeta en vivo desde el USGS.
 * Es contexto (p. ej. el Cinturón de Fuego); las reglas, los modelos y los indicadores
 * siguen usando solo la zona del Perú.
 */
export default function VistaMundo() {
  const [periodo, setPeriodo] = useState<PeriodoMundo>("semana");
  const [magMin, setMagMin] = useState(4.5);
  const [datos, setDatos] = useState<RespuestaMundo | null>(null);
  const [paises, setPaises] = useState<PaisMundo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);
  const [selId, setSelId] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    Promise.all([cargarSismosMundo(periodo), cargarPaises()])
      .then(([d, p]) => {
        if (!vivo) return;
        setDatos(d);
        setPaises(p);
      })
      .catch((e) => {
        if (vivo) setError((e as { detail?: string })?.detail ?? "No se pudo cargar la vista mundial.");
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [periodo, intento]);

  const visibles = useMemo(() => (datos?.items ?? []).filter((s) => s.magnitud >= magMin), [datos, magMin]);
  const porMagnitud = useMemo(() => [...visibles].sort((a, b) => b.magnitud - a.magnitud), [visibles]);
  const maximo = porMagnitud[0] ?? null;
  const enZona = visibles.filter((s) => s.zona_peru).length;
  const sel: SismoMundo | null = visibles.find((s) => s.id === selId) ?? null;
  const etiquetaPeriodo = PERIODOS_MUNDO.find((p) => p.valor === periodo)?.etiqueta ?? "";

  return (
    <div>
      <p
        role="note"
        className="mb-3 flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2.5 text-xs leading-relaxed text-content-secondary"
      >
        <IconInfo size={14} className="mt-0.5 shrink-0 text-accent-600" />
        <span>
          <b className="font-semibold text-content">Contexto mundial en vivo.</b> Sismos M4.5+ ya ocurridos que publica el USGS,
          consultados en el momento (no se guardan). Los avisos, los modelos y los indicadores usan solo la{" "}
          <b className="font-semibold text-content">zona del Perú</b> (recuadro punteado). Un punto marca el origen del sismo, no su alcance.
        </span>
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-3.5 py-2.5">
        <div className="inline-flex overflow-hidden rounded-md border border-border" role="group" aria-label="Periodo">
          {PERIODOS_MUNDO.map((p) => (
            <button key={p.valor} type="button" className={btn(periodo === p.valor)} aria-pressed={periodo === p.valor} onClick={() => setPeriodo(p.valor)}>
              {p.etiqueta}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-content-secondary">
          Magnitud mínima
          <select
            value={magMin}
            onChange={(e) => setMagMin(Number(e.target.value))}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-content"
          >
            {MAGNITUDES.map((m) => (
              <option key={m} value={m}>
                M{m.toFixed(1)}+
              </option>
            ))}
          </select>
        </label>
        {datos && (
          <span className="ml-auto text-[11px] text-content-muted">
            Fuente: USGS (en vivo) · actualizado {datos.generado_fuente ? `${fmtDateTimeUTC5(datos.generado_fuente)} (UTC-5)` : "—"}
          </span>
        )}
      </div>

      {datos?.desactualizado && (
        <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-warning bg-surface px-3.5 py-2 text-xs text-content-secondary">
          <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
          El USGS no respondió: se muestra la última copia disponible.
        </p>
      )}

      {error ? (
        <div className="rounded-lg border border-border bg-surface px-4 py-8 text-center">
          <p className="text-sm font-medium text-content">Vista mundial no disponible</p>
          <p className="mt-1 text-xs text-content-muted">{error}</p>
          <button
            type="button"
            onClick={() => setIntento((n) => n + 1)}
            className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-content hover:bg-surface-tertiary"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Dato etiqueta={`Sismos M${magMin.toFixed(1)}+ (${etiquetaPeriodo})`} valor={cargando ? "…" : visibles.length.toLocaleString("es-PE")} detalle="En todo el mundo" />
            <Dato
              etiqueta="Magnitud máxima"
              valor={maximo ? `${maximo.magnitud.toFixed(1)} ${maximo.tipo_magnitud ?? ""}` : "—"}
              detalle={maximo?.lugar ?? "Sin sismos en el periodo"}
            />
            <Dato etiqueta="En la zona del Perú" valor={cargando ? "…" : String(enZona)} detalle="Dentro del recuadro vigilado" />
            <Dato etiqueta="Revisados por el USGS" valor={cargando ? "…" : String(visibles.filter((s) => s.estado === "reviewed").length)} detalle="El resto es automático y puede cambiar" />
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-h-[260px]">
              {paises ? (
                <PlanisferioSvg paises={paises} sismos={visibles} seleccionadoId={selId} onSeleccionar={(s) => setSelId(s.id)} />
              ) : (
                <div className="flex h-full min-h-[260px] items-center justify-center rounded-lg border border-border bg-surface text-xs text-content-muted">
                  Cargando el planisferio…
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-content-muted">
                Tamaño del punto según la magnitud · el Perú en celeste · recuadro punteado: zona del catálogo de trabajo.
              </p>
            </div>

            <aside className="flex max-h-[520px] min-h-0 flex-col rounded-[10px] border border-border bg-surface" aria-label="Sismos del periodo">
              {sel ? (
                <div className="border-b border-border px-3.5 py-3 text-xs">
                  <p className="text-sm font-semibold text-content">
                    M{sel.magnitud.toFixed(1)} {sel.tipo_magnitud ?? ""}
                  </p>
                  <p className="mt-0.5 text-content-secondary">{sel.lugar ?? "Lugar sin nombre"}</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                    <dt className="text-content-muted">Fecha</dt>
                    <dd className="text-content-secondary">{sel.fecha ? `${fmtDateTimeUTC5(sel.fecha)} (UTC-5)` : "—"}</dd>
                    <dt className="text-content-muted">Profundidad</dt>
                    <dd className="text-content-secondary">{sel.profundidad_km != null ? `${sel.profundidad_km} km` : "—"}</dd>
                    <dt className="text-content-muted">Coordenadas</dt>
                    <dd className="text-content-secondary">
                      {sel.lat.toFixed(2)}, {sel.lon.toFixed(2)}
                    </dd>
                    <dt className="text-content-muted">Estado</dt>
                    <dd className="text-content-secondary">{sel.estado === "reviewed" ? "Revisado por el USGS" : "Automático (puede cambiar)"}</dd>
                  </dl>
                  {sel.zona_peru && (
                    <p className="mt-2 text-[11px] text-content-secondary">Está en la zona del Perú: también llega al catálogo de trabajo con la sincronización.</p>
                  )}
                  <div className="mt-2 flex gap-3">
                    {sel.url && (
                      <a href={sel.url} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-accent-700 underline dark:text-accent-300">
                        Ver en el USGS
                      </a>
                    )}
                    <button type="button" onClick={() => setSelId(null)} className="text-[11px] text-content-muted underline">
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="border-b border-border px-3.5 py-2.5 text-[11px] text-content-muted">Pulsa un punto o un sismo de la lista para ver su detalle.</p>
              )}
              <h2 className="px-3.5 pt-2.5 text-xs font-semibold uppercase tracking-wide text-content">Más fuertes del periodo</h2>
              <ul className="min-h-0 flex-1 overflow-auto px-1.5 py-1.5">
                {porMagnitud.slice(0, 40).map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelId(s.id)}
                      className={`flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left text-[11px] hover:bg-surface-tertiary ${s.id === selId ? "bg-surface-tertiary" : ""}`}
                    >
                      <b className="w-9 shrink-0 tabular-nums text-content">{s.magnitud.toFixed(1)}</b>
                      <span className="line-clamp-1 flex-1 text-content-secondary">{s.lugar ?? "—"}</span>
                    </button>
                  </li>
                ))}
                {!cargando && porMagnitud.length === 0 && <li className="px-2 py-3 text-[11px] text-content-muted">Sin sismos con ese filtro.</li>}
              </ul>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function Dato({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-surface px-3.5 py-2.5">
      <small className="block text-[10px] uppercase tracking-[0.04em] text-content-muted">{etiqueta}</small>
      <b className="block text-lg font-bold leading-tight text-content">{valor}</b>
      <span className="line-clamp-1 text-[11px] text-content-muted">{detalle}</span>
    </div>
  );
}
