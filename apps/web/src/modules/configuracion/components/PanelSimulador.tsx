import { useEffect, useState } from "react";
import { Link } from "react-router";
import Card from "@/components/ui/Card";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { IconActivity, IconInfo } from "@/components/ui/Icons";

interface EstadoDemo {
  activo: boolean;
  zonas: { clave: string; nombre: string }[];
  fuente: string;
}

interface ResultadoSimulacion {
  sismos: { external_id: string; magnitud: number; profundidad_km: number; region: string | null }[];
  avisos: { id: string; titulo: string; estado: string }[];
  nota: string;
}

const campoCls = "rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-content focus:border-accent-500 focus:outline-none";

/**
 * Simulador de sismos ficticios para demostraciones (D29). Solo aparece si el servidor
 * tiene DEMO_SIMULACION=true. Cada sismo pasa por la ingesta y el motor de avisos reales.
 */
export default function PanelSimulador() {
  const [estado, setEstado] = useState<EstadoDemo | null>(null);
  const [zona, setZona] = useState("mina_arequipa");
  const [magnitud, setMagnitud] = useState("5.2");
  const [cantidad, setCantidad] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSimulacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<EstadoDemo>("/demo/status").then(setEstado).catch(() => setEstado(null));
  }, []);

  if (!estado?.activo) return null;

  const simular = async () => {
    setEnviando(true);
    setError(null);
    try {
      setResultado(await apiPost<ResultadoSimulacion>("/demo/simulate", { zona, magnitud: Number(magnitud), cantidad }));
    } catch (e) {
      setError(e instanceof ApiError && e.detail ? e.detail : "No se pudo simular el sismo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mb-4">
    <Card title="Simulador de sismos (demostración)" help="Crea sismos ficticios que recorren la ingesta, las reglas y los avisos reales.">
      <p role="note" className="mb-3 flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-slate-500 bg-surface-secondary px-3 py-2 text-[11px] text-content-secondary">
        <IconInfo size={13} className="mt-0.5 shrink-0" />
        <span>
          Solo para esta demostración. Los sismos son <b className="text-content">ficticios</b>: aparecen como <b className="text-content">[SIMULADO]</b> y
          con la fuente “{estado.fuente}”. Llegan como un sismo real: se les asigna departamento, se evalúan con las reglas
          activas y generan avisos.
        </span>
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-content-secondary">Zona</span>
          <select value={zona} onChange={(e) => setZona(e.target.value)} className={campoCls}>
            {estado.zonas.map((z) => (
              <option key={z.clave} value={z.clave}>{z.nombre}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-content-secondary">Magnitud</span>
          <input inputMode="decimal" value={magnitud} onChange={(e) => setMagnitud(e.target.value)} className={`${campoCls} w-20`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-content-secondary">Sismos</span>
          <select value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} className={campoCls}>
            <option value={1}>Uno</option>
            <option value={3}>Uno con 2 réplicas</option>
            <option value={5}>Uno con 4 réplicas</option>
          </select>
        </label>
        <button
          type="button"
          onClick={simular}
          disabled={enviando || !(Number(magnitud) >= 2.5 && Number(magnitud) <= 8.5)}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:opacity-40"
        >
          <IconActivity size={13} />
          {enviando ? "Simulando…" : "Simular sismo"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-border border-l-2 border-l-rose-600 bg-surface px-3 py-2 text-[11px] text-content-secondary">
          {error}
        </p>
      )}

      {resultado && (
        <div className="mt-3 space-y-2 text-xs">
          <p className="font-medium text-content">
            {resultado.sismos.length} sismo(s) simulado(s) ·{" "}
            {resultado.avisos.length > 0 ? `${resultado.avisos.length} aviso(s) generado(s)` : "ninguna regla activa los cubrió"}
          </p>
          <ul className="space-y-0.5 text-content-secondary">
            {resultado.sismos.map((s) => (
              <li key={s.external_id}>
                M{s.magnitud.toFixed(1)} · {s.profundidad_km} km de profundidad · {s.region ?? "sin departamento"}
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap gap-3">
            <Link to="/alertas?estado=pendiente_aprobacion" className="font-medium text-accent-700 underline dark:text-accent-300">Ver en el Centro de alertas</Link>
            <Link to="/eventos?periodo=24h" className="font-medium text-accent-700 underline dark:text-accent-300">Ver en Eventos (24 h)</Link>
            <Link to="/" className="font-medium text-accent-700 underline dark:text-accent-300">Ver en el Dashboard</Link>
          </p>
        </div>
      )}
    </Card>
    </div>
  );
}
