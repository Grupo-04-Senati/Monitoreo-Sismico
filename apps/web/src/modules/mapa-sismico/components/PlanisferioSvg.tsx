import { useMemo } from "react";
import { COLOR_PUNTO, SIN_EVENTOS, crearProyector, pathDePoligonos } from "../lib/geo";
import { CAJA_MUNDO, ZONA_PERU, radioMundo, type PaisMundo, type SismoMundo } from "../services/mundo.service";

const LINEA_GRILLA = "#e2e8f0";
const BORDE_PAIS = "#94a3b8";
const RELLENO_PERU = "#cdeff3";
const COLOR_ZONA = "var(--accent-600)";

/**
 * Planisferio (equirectangular) con los contornos de países y los sismos M4.5+ del mundo.
 * El Perú y la zona que vigila el catálogo de trabajo se resaltan con un recuadro punteado.
 * Colores neutros (cian): el tamaño del punto indica la magnitud, nunca un nivel de peligro.
 */
export default function PlanisferioSvg({
  paises,
  sismos,
  seleccionadoId = null,
  onSeleccionar,
  compacto = false,
}: {
  paises: PaisMundo[];
  sismos: SismoMundo[];
  seleccionadoId?: string | null;
  onSeleccionar?: (s: SismoMundo) => void;
  compacto?: boolean;
}) {
  const proy = useMemo(() => crearProyector(CAJA_MUNDO, 1000, 0.01), []);
  const trazos = useMemo(() => paises.map((p) => ({ iso: p.iso, nombre: p.nombre, d: pathDePoligonos(p.polys, proy) })), [paises, proy]);
  // Los más fuertes al final: quedan encima y no los tapan los pequeños.
  const ordenados = useMemo(() => [...sismos].sort((a, b) => a.magnitud - b.magnitud), [sismos]);

  const [zx1, zy1] = proy(ZONA_PERU.lonMin, ZONA_PERU.latMax);
  const [zx2, zy2] = proy(ZONA_PERU.lonMax, ZONA_PERU.latMin);
  const meridianos = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
  const paralelos = [-30, 0, 30, 60];
  const interactivo = Boolean(onSeleccionar) && !compacto;

  return (
    <svg
      viewBox={`0 0 ${proy.width} ${proy.height}`}
      role={interactivo ? "group" : "img"}
      aria-label={`Planisferio con ${sismos.length} sismos M4.5+`}
      className="h-full w-full rounded-lg border border-border bg-white"
      preserveAspectRatio="xMidYMid meet"
    >
      <g aria-hidden="true">
        {meridianos.map((lon) => {
          const [x1, y1] = proy(lon, CAJA_MUNDO[3]);
          const [, y2] = proy(lon, CAJA_MUNDO[1]);
          return <line key={`m${lon}`} x1={x1} y1={y1} x2={x1} y2={y2} stroke={LINEA_GRILLA} strokeWidth={lon === 0 ? 1 : 0.6} />;
        })}
        {paralelos.map((lat) => {
          const [x1, y] = proy(CAJA_MUNDO[0], lat);
          const [x2] = proy(CAJA_MUNDO[2], lat);
          return <line key={`p${lat}`} x1={x1} y1={y} x2={x2} y2={y} stroke={LINEA_GRILLA} strokeWidth={lat === 0 ? 1 : 0.6} />;
        })}
      </g>

      <g aria-hidden="true">
        {trazos.map((t) => (
          <path key={t.iso + t.nombre} d={t.d} fill={t.iso === "PER" ? RELLENO_PERU : SIN_EVENTOS} stroke={BORDE_PAIS} strokeWidth={0.4}>
            {!compacto && <title>{t.nombre}</title>}
          </path>
        ))}
        <rect
          x={zx1}
          y={zy1}
          width={zx2 - zx1}
          height={zy2 - zy1}
          fill="none"
          stroke={COLOR_ZONA}
          strokeWidth={compacto ? 1.4 : 1}
          strokeDasharray="4 3"
        >
          <title>Zona del catálogo de trabajo (Perú): reglas, modelos e indicadores</title>
        </rect>
      </g>

      {ordenados.map((s) => {
        const [x, y] = proy(s.lon, s.lat);
        const sel = s.id === seleccionadoId;
        const r = radioMundo(s.magnitud) * (compacto ? 1.3 : 1);
        const etiqueta = `M${s.magnitud.toFixed(1)} · ${s.lugar ?? "lugar sin nombre"}`;
        return (
          <circle
            key={s.id}
            cx={x}
            cy={y}
            r={r}
            fill={COLOR_PUNTO}
            fillOpacity={sel ? 0.95 : 0.72}
            stroke={sel ? "#0f172a" : "#ffffff"}
            strokeWidth={sel ? 1.6 : 0.6}
            className={interactivo ? "cursor-pointer" : undefined}
            role={interactivo ? "button" : undefined}
            tabIndex={interactivo ? 0 : undefined}
            aria-label={interactivo ? etiqueta : undefined}
            onClick={interactivo ? () => onSeleccionar?.(s) : undefined}
            onKeyDown={
              interactivo
                ? (ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      onSeleccionar?.(s);
                    }
                  }
                : undefined
            }
          >
            {!compacto && <title>{etiqueta}</title>}
          </circle>
        );
      })}
    </svg>
  );
}
