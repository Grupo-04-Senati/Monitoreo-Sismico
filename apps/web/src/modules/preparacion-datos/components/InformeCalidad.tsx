import { IconAlertTriangle } from "@/components/ui/Icons";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { InformeCalidad as Informe, Rango } from "../types";
import { ETIQUETA_CAMPO, ETIQUETA_REGLA, ETIQUETA_REVISION, fmtDiaUTC } from "../schemas/datasets.schema";

const n = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("es-PE"));

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-3">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-content-secondary">{titulo}</h4>
      {children}
    </section>
  );
}

function Filas({ filas }: { filas: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
      {filas.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-content-secondary">{k}</dt>
          <dd className="text-right font-medium text-content">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function rango(r: Rango, unidad = ""): [string, string][] {
  const u = unidad ? ` ${unidad}` : "";
  return [
    ["Mínimo", r.minimo == null ? "—" : `${r.minimo}${u}`],
    ["Mediana", r.mediana == null ? "—" : `${r.mediana}${u}`],
    ["Media", r.media == null ? "—" : `${r.media}${u}`],
    ["Máximo", r.maximo == null ? "—" : `${r.maximo}${u}`],
  ];
}

/** Barra horizontal proporcional (sin colores de peligro). */
function Barras({ conteos, etiquetas, total }: { conteos: Record<string, number>; etiquetas?: Record<string, string>; total: number }) {
  const filas = Object.entries(conteos).sort((a, b) => b[1] - a[1]);
  if (filas.length === 0) return <p className="text-xs text-content-muted">—</p>;
  return (
    <ul className="space-y-1.5">
      {filas.map(([clave, valor]) => (
        <li key={clave} className="text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-content-secondary">{etiquetas?.[clave] ?? clave}</span>
            <span className="font-medium text-content">
              {n(valor)}
              <span className="ml-1 font-normal text-content-muted">({total ? Math.round((valor / total) * 100) : 0}%)</span>
            </span>
          </div>
          <div className="mt-0.5 h-1.5 rounded-full bg-surface-tertiary" aria-hidden="true">
            <div className="h-1.5 rounded-full bg-accent-500" style={{ width: `${total ? (valor / total) * 100 : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Informe de calidad de un dataset (calculado por el backend al crearlo). */
export default function InformeCalidad({ informe }: { informe: Informe }) {
  const eliminadas = Object.entries(informe.eliminadas_por_regla);
  const totalEliminadas = informe.filas_origen - informe.filas_finales;
  const imp = informe.imputacion;
  const meses = informe.cobertura_temporal;

  return (
    <div className="space-y-3">
      {informe.advertencias.length > 0 && (
        <div role="note" className="rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3 py-2.5">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-content">
            <IconAlertTriangle size={13} className="text-accent-600" />
            Advertencias ({informe.advertencias.length})
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-[11px] text-content-secondary">
            {informe.advertencias.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-content-secondary">
        <b className="font-semibold text-content">Zona:</b> {informe.zona?.descripcion ?? "Toda la cobertura del catálogo (Perú y alrededores)"}
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Bloque titulo="Filas">
          <Filas
            filas={[
              ...(informe.zona && informe.zona.tipo !== "todo"
                ? ([
                    ["Del catálogo (periodo)", n(informe.zona.eventos_del_periodo)],
                    ["Fuera de la zona", n(informe.zona.fuera_de_zona)],
                  ] as [string, string][])
                : []),
              [informe.zona && informe.zona.tipo !== "todo" ? "En la zona" : "Del catálogo (periodo)", n(informe.filas_origen)],
              ["Quitadas por las reglas", n(totalEliminadas)],
              ["En el dataset", n(informe.filas_finales)],
            ]}
          />
        </Bloque>
        <Bloque titulo="Partición temporal">
          <Filas
            filas={[
              ["Fecha de corte (UTC)", informe.particion.fecha_corte ? fmtDiaUTC(informe.particion.fecha_corte) : "Sin partición"],
              ["Entrenamiento", n(informe.particion.entrenamiento)],
              ["Prueba", n(informe.particion.prueba)],
            ]}
          />
        </Bloque>
        <Bloque titulo="Imputación">
          <Filas
            filas={
              imp.metodo === "mediana"
                ? [
                    ["Método", "Mediana"],
                    ["Campo", ETIQUETA_CAMPO[imp.campo ?? ""] ?? imp.campo ?? "—"],
                    ["Valor usado", imp.valor == null ? "—" : `${imp.valor} km`],
                    ["Filas imputadas", n(imp.filas_imputadas)],
                  ]
                : [["Método", "Ninguna"]]
            }
          />
        </Bloque>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Bloque titulo="Filas quitadas por regla (en orden)">
          {eliminadas.length === 0 ? (
            <p className="text-xs text-content-muted">Ninguna regla quitó filas.</p>
          ) : (
            <Filas filas={eliminadas.map(([k, v]) => [ETIQUETA_REGLA[k] ?? k, n(v)])} />
          )}
          <p className="mt-2 text-[10px] text-content-muted">
            Posibles duplicados detectados: {n(informe.posibles_duplicados.detectados)} ({informe.posibles_duplicados.criterio}).
          </p>
        </Bloque>
        <Bloque titulo="Nulos por campo (antes de limpiar)">
          <Filas
            filas={Object.entries(informe.nulos_por_campo).map(([k, v]) => [
              ETIQUETA_CAMPO[k] ?? k,
              `${n(v)} (${informe.filas_origen ? Math.round((v / informe.filas_origen) * 100) : 0}%)`,
            ])}
          />
        </Bloque>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Bloque titulo="Tipo de magnitud">
          <Barras conteos={informe.distribucion.tipo_magnitud} total={informe.filas_finales} />
        </Bloque>
        <Bloque titulo="Estado de revisión">
          <Barras conteos={informe.distribucion.estado_revision} etiquetas={ETIQUETA_REVISION} total={informe.filas_finales} />
        </Bloque>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Bloque titulo="Magnitud">
          <Filas filas={rango(informe.magnitud)} />
        </Bloque>
        <Bloque titulo="Profundidad">
          <Filas filas={rango(informe.profundidad_km, "km")} />
        </Bloque>
        <Bloque titulo="Cobertura temporal">
          <Filas
            filas={[
              ["Primer evento", meses.primer_evento ? fmtDateTimeUTC5(meses.primer_evento) : "—"],
              ["Último evento", meses.ultimo_evento ? fmtDateTimeUTC5(meses.ultimo_evento) : "—"],
              ["Meses del periodo", n(meses.meses)],
              ["Meses sin eventos", n(meses.meses_sin_eventos.length)],
            ]}
          />
          {meses.meses_sin_eventos.length > 0 && (
            <details className="mt-2 text-[11px] text-content-secondary">
              <summary className="cursor-pointer">Ver meses sin eventos</summary>
              <p className="mt-1 break-words">{meses.meses_sin_eventos.join(", ")}</p>
            </details>
          )}
        </Bloque>
      </div>
    </div>
  );
}
