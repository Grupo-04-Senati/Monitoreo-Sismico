import { useEffect, useState } from "react";
import { DEPT_PATHS } from "@/components/background/deptPaths";

/* Log de la consola (decorativo, cicla) — textos del panel original */
const LOG_LINES = [
  "INICIANDO PROTOCOLO DE ESCANEO...",
  "CARGANDO MALLA TECTONICA V.2.1",
  "SISMOS REGISTRADOS EN LINEA",
  "MONITOREO SISMICO ACTIVO",
  "INTERVALO DE BARRIDO: 0.8 s",
  "PATRON INICIAL: 2547",
  "ANALIZANDO PERFIL SISMICO...",
  "ANCHO ESPACIAL: CORREL.",
  "COORDENADAS BLOQUEADAS: 25/25",
  "PUNTO GEOLOGICO: LISTO",
  "BUSQUEDA INTELIGENTE: 0.02s",
  "MALLA DE DATOS: OK",
  "ESTADO: MONITOREO EN CURSO",
  "CANAL UPS: SINCRONIZACION",
  "REGISTRO SISMICO ACTUALIZADO",
];

const MUTED = "#7E97AD";
const BRIGHT = "#EAF6FA";

/**
 * Panel escáner del Perú (solo diseño del login/registro).
 * Sin datos operativos: log y readouts son decorativos.
 */
export default function PeruMap() {
  const [hover, setHover] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 750);
    return () => window.clearInterval(id);
  }, []);

  const visibleLog = Array.from(
    { length: 15 },
    (_, i) => LOG_LINES[(tick + i) % LOG_LINES.length],
  );
  const depts = Object.entries(DEPT_PATHS);

  /* Hora actual en UTC-5 (Lima), se actualiza con cada tic */
  const now5 = new Date(Date.now() - 5 * 3600_000);
  const hora = `${String(now5.getUTCHours()).padStart(2, "0")}:${String(now5.getUTCMinutes()).padStart(2, "0")}:${String(now5.getUTCSeconds()).padStart(2, "0")}`;

  return (
    <div className="w-full max-w-[700px] flex gap-3 select-none">
      {/* Consola // SEC.LOG + readout — ambas cajas con la misma altura */}
      <div className="hidden xl:flex w-56 shrink-0 flex-col gap-3">
        <div className="relative border border-accent-600 bg-black/50 p-3 flex-1 min-h-0 overflow-hidden backdrop-blur-sm">
          <p className="font-mono text-[11px] tracking-widest text-accent-500 flex items-center justify-between mb-2">
            // SEC.LOG
            <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" aria-hidden="true" />
          </p>
          <div aria-hidden="true">
            {visibleLog.map((line, i) => (
              <p
                key={`${tick}-${i}`}
                style={{
                  opacity: 0.4 + (i / visibleLog.length) * 0.6,
                  color: i === visibleLog.length - 1 ? "#4CC9E0" : "#3FA8C4",
                }}
                className="font-mono text-[10.5px] leading-[1.6] whitespace-nowrap overflow-hidden text-ellipsis"
              >
                {line}
              </p>
            ))}
          </div>
          <p className="font-mono text-[11px] text-accent-500 animate-pulse mt-1" aria-hidden="true">▌</p>
        </div>

        <div className="border border-accent-600 bg-black/50 p-3 shrink-0 backdrop-blur-sm space-y-1.5">
          {[
            ["LAT", "-9.1900°"],
            ["LONG", "-75.0000°"],
            ["PROF", "14.2 km"],
            ["REG", hover ? hover.toUpperCase().slice(0, 9) : "—"],
            ["MAG", "5.8"],
            ["HORA", hora],
          ].map(([k, v]) => (
            <p key={k} className="font-mono text-[10.5px] flex justify-between gap-2">
              <span style={{ color: MUTED }}>{k}</span>
              <span className="text-accent-500">{v}</span>
            </p>
          ))}
        </div>

        {/* Radar decorativo: absorbe el espacio sobrante de la columna */}
        <div className="border border-accent-600 bg-black/50 p-3 flex-1 min-h-0 flex flex-col backdrop-blur-sm">
          <p className="font-mono text-[11px] tracking-widest text-accent-500 flex items-center justify-between mb-1.5">
            // RADAR
            <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" aria-hidden="true" />
          </p>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full max-h-full"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <radialGradient id="pmark-radar-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#4CC9E0" stopOpacity="0.14" />
                  <stop offset="100%" stopColor="#4CC9E0" stopOpacity="0" />
                </radialGradient>
                <style>{`
                  @keyframes pradar-spin { to { transform: rotate(360deg); } }
                  .pradar-sweep { transform-box: view-box; transform-origin: 50px 50px; animation: pradar-spin 3.6s linear infinite; }
                  @keyframes pradar-blip { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
                  .pradar-blip { animation: pradar-blip 2.4s ease-in-out infinite; }
                `}</style>
              </defs>

              <circle cx="50" cy="50" r="46" fill="url(#pmark-radar-glow)" />
              <g fill="none" stroke="#2E5F8A" strokeWidth="0.6">
                <circle cx="50" cy="50" r="46" />
                <circle cx="50" cy="50" r="31" />
                <circle cx="50" cy="50" r="16" />
              </g>
              <g stroke="rgba(76,201,224,0.25)" strokeWidth="0.4">
                <line x1="50" y1="4" x2="50" y2="96" />
                <line x1="4" y1="50" x2="96" y2="50" />
              </g>

              {/* Brazo de barrido */}
              <g className="pradar-sweep">
                <path
                  d="M50 50 L50 4 A46 46 0 0 1 82.5 17.5 Z"
                  fill="rgba(76,201,224,0.22)"
                />
                <line x1="50" y1="50" x2="50" y2="4" stroke="#4CC9E0" strokeWidth="0.8" />
              </g>

              {/* Blips decorativos */}
              <circle className="pradar-blip" cx="68" cy="34" r="1.8" fill="#4CC9E0" />
              <circle
                className="pradar-blip" cx="34" cy="63" r="1.5" fill="#4CC9E0"
                style={{ animationDelay: "0.8s" }}
              />
              <circle
                className="pradar-blip" cx="61" cy="72" r="1.3" fill="#4CC9E0"
                style={{ animationDelay: "1.6s" }}
              />
              <circle cx="50" cy="50" r="1.6" fill="#4CC9E0" />
            </svg>
          </div>
        </div>
      </div>

      {/* Panel del mapa */}
      <div className="relative flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-end justify-between gap-2 mb-2.5">
          <p className="font-mono text-2xl font-bold tracking-[0.35em] leading-none" style={{ color: BRIGHT }}>
            PERÚ
          </p>
          <p className="font-mono text-[11px] tracking-widest text-accent-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" aria-hidden="true" />
            ESCANEANDO
          </p>
        </div>

        {/* Marco con esquinas */}
        <div className="relative border border-accent-600 bg-black/40 backdrop-blur-sm p-3 pb-6">
          <span className="absolute -top-px -left-px w-5 h-5 border-t-2 border-l-2 border-accent-500" aria-hidden="true" />
          <span className="absolute -top-px -right-px w-5 h-5 border-t-2 border-r-2 border-accent-500" aria-hidden="true" />
          <span className="absolute -bottom-px -left-px w-5 h-5 border-b-2 border-l-2 border-accent-500" aria-hidden="true" />
          <span className="absolute -bottom-px -right-px w-5 h-5 border-b-2 border-r-2 border-accent-500" aria-hidden="true" />

          <p className="absolute top-1.5 left-4 font-mono text-[10px]" style={{ color: MUTED }}>81°59' O</p>
          <p className="absolute top-1.5 right-4 font-mono text-[10px]" style={{ color: MUTED }}>68°49' O</p>

          {/* Mapa */}
          <div className="relative overflow-hidden">
            <svg
              viewBox="0 0 18908 27438"
              className="w-full h-auto max-h-[70vh]"
              role="img"
              aria-label="Mapa decorativo del Perú en modo escáner"
            >
              <defs>
                <linearGradient id="pmap-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#223F6A" />
                  <stop offset="100%" stopColor="#16264A" />
                </linearGradient>
                <style>{`
                  .pdept path { transition: fill 0.2s ease, stroke 0.2s ease; }
                  .pdept { cursor: crosshair; }
                  .pdept:hover path { fill: #2B5A87; stroke: #4CC9E0; }
                  @keyframes pmap-sweep { 0% { top: -14%; } 100% { top: 100%; } }
                  .pmap-sweep { position: absolute; left: 0; right: 0; animation: pmap-sweep 4s linear infinite; }
                `}</style>
              </defs>

              {depts.map(([key, { name, d }]) => (
                <g
                  key={key}
                  className="pdept"
                  onMouseEnter={() => setHover(name)}
                  onMouseLeave={() => setHover((h) => (h === name ? null : h))}
                >
                  <title>{name}</title>
                  <path d={d} fill="url(#pmap-fill)" stroke="#3E6A9E" strokeWidth="34" strokeLinejoin="round" />
                </g>
              ))}
            </svg>

            {/* Barrido de escaneo: recorre TODO el alto del contenedor */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
              <div
                className="pmap-sweep h-16"
                style={{
                  background: "linear-gradient(to bottom, transparent, rgba(76,201,224,0.18))",
                  borderBottom: "1px solid rgba(76,201,224,0.55)",
                }}
              />
            </div>

            {/* Nombre de la región al tocarla */}
            {hover && (
              <div
                className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/85 border border-accent-500 pointer-events-none"
                role="status"
              >
                <p className="font-mono text-[12px] tracking-[0.2em] text-accent-500 whitespace-nowrap">
                  &gt; {hover.toUpperCase()} <span style={{ color: MUTED }}>// EN ESCANEO</span>
                </p>
              </div>
            )}
          </div>

          <p className="absolute bottom-1.5 left-4 font-mono text-[10px]" style={{ color: MUTED }}>0°02' S</p>
          <p className="absolute bottom-1.5 right-4 font-mono text-[10px]" style={{ color: MUTED }}>18°21' S</p>
        </div>

        {/* Footer: barra + leyenda */}
        <div className="mt-2.5 space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[10px] tracking-widest whitespace-nowrap" style={{ color: MUTED }}>
              ESCANEO TERMINAL
            </span>
            <div className="flex-1 h-1.5 bg-surface-tertiary overflow-hidden">
              <div
                className="h-full bg-accent-500 transition-all duration-1000"
                style={{ width: `${62 + (tick % 6) * 6}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
