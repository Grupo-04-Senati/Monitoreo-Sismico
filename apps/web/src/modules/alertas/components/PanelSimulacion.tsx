import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { fmtDateTimeUTC5 } from "@/lib/format";
import { IconActivity } from "@/components/ui/Icons";
import type { ReglaIn, Simulacion } from "../types";
import { DIAS_SIMULACION, fmtKm, fmtMagnitud } from "../schemas/alertas.schema";
import { simularRegla } from "../services/alertas.service";

interface PanelSimulacionProps {
  /** Regla a simular, o el motivo por el que aún no se puede (formulario incompleto). */
  regla: ReglaIn | null;
  problema?: string | null;
}

/**
 * Simulación retrospectiva: cuántos avisos habría generado la regla con los sismos
 * ya registrados en los últimos N días. No crea avisos ni entregas.
 */
export default function PanelSimulacion({ regla, problema }: PanelSimulacionProps) {
  const [dias, setDias] = useState(365);
  const [resultado, setResultado] = useState<Simulacion | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si la regla cambia, el resultado anterior ya no la describe.
  const firma = JSON.stringify(regla);
  useEffect(() => {
    setResultado(null);
    setError(null);
  }, [firma, dias]);

  const simular = async () => {
    if (!regla) return;
    setCargando(true);
    setError(null);
    try {
      setResultado(await simularRegla(regla, dias));
    } catch (e) {
      setError(e instanceof ApiError && e.detail ? e.detail : "No se pudo simular la regla.");
    } finally {
      setCargando(false);
    }
  };

  const cifras: [string, number][] = resultado
    ? [
        ["Sismos evaluados", resultado.eventos_evaluados],
        ["Cumplen la regla", resultado.coincidencias],
        ["Avisos que habría", resultado.alertas],
        ["Suprimidos por espera", resultado.suprimidas_por_cooldown],
      ]
    : [];

  return (
    <section className="rounded-lg border border-border bg-surface-secondary p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-semibold text-content">Simular con sismos ya registrados</h4>
        <select
          value={dias}
          onChange={(e) => setDias(Number(e.target.value))}
          aria-label="Periodo de la simulación"
          className="ml-auto rounded-md border border-border bg-surface px-2 py-1 text-xs text-content"
        >
          {DIAS_SIMULACION.map((d) => (
            <option key={d.value} value={d.value}>Últimos {d.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={simular}
          disabled={!regla || cargando}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-content transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconActivity size={13} />
          {cargando ? "Simulando…" : "Simular"}
        </button>
      </div>

      {!regla && problema && <p className="mt-2 text-[11px] text-content-muted">Para simular: {problema}</p>}
      {error && (
        <p role="alert" className="mt-2 rounded-md border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2 text-[11px] text-content-secondary">
          {error}
        </p>
      )}

      {resultado && (
        <div className="mt-3 space-y-3">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {cifras.map(([k, v]) => (
              <div key={k} className="rounded-md border border-border bg-surface px-2.5 py-2">
                <dt className="text-[10px] uppercase tracking-wide text-content-muted">{k}</dt>
                <dd className="text-lg font-bold text-content">{v.toLocaleString("es-PE")}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-content-muted">
            Desde el {fmtDateTimeUTC5(resultado.desde)} (UTC-5). {resultado.nota}
          </p>
          {resultado.ejemplos.length > 0 && (
            <div className="max-h-56 overflow-auto rounded-md border border-border bg-surface">
              <table className="w-full text-[11px]">
                <caption className="sr-only">Sismos más recientes que cumplen la regla</caption>
                <thead className="sticky top-0 bg-surface-secondary">
                  <tr>
                    {["Fecha (UTC-5)", "Magnitud", "Lugar", "Distancia", "Resultado"].map((h) => (
                      <th key={h} scope="col" className="px-2 py-1.5 text-left font-semibold text-content-secondary">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultado.ejemplos.map((e) => (
                    <tr key={e.event_id} className="border-t border-border">
                      <td className="whitespace-nowrap px-2 py-1.5 text-content-secondary">{fmtDateTimeUTC5(e.occurred_at)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 font-medium text-content">{fmtMagnitud(e.magnitude, e.magnitude_type)}</td>
                      <td className="px-2 py-1.5 text-content-secondary">{e.locality ?? "—"}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-content-secondary">{fmtKm(e.distance_km)}</td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-content-secondary">{e.suprimida ? "Suprimido (espera)" : "Aviso"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {resultado.ejemplos.length > 0 && resultado.coincidencias > resultado.ejemplos.length && (
            <p className="text-[11px] text-content-muted">Se muestran los {resultado.ejemplos.length} más recientes.</p>
          )}
        </div>
      )}
    </section>
  );
}
