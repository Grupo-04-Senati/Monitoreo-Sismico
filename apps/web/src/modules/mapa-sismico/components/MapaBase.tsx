import { useMemo, useRef } from "react";
import type { CapaMapa, EventoSismico, GeoRegiones, RegionResumen } from "../types";
import { COLOR_PUNTO, SIN_EVENTOS, agruparPuntos, crearProyector, escalaCian, radioMagnitud } from "../lib/geo";
import { IconAlertTriangle, IconLayers, IconMapPin, IconUpload } from "@/components/ui/Icons";
import LeyendaMapa from "./LeyendaMapa";

interface MapaBaseProps {
  geo: GeoRegiones | null;
  errorGeo: string | null;
  nombreArchivo: string | null;
  onCargarArchivo: (file: File) => void;
  onLimpiarArchivo: () => void;
  eventos: EventoSismico[];
  regiones: RegionResumen[];
  capa: CapaMapa;
  radio: { lat: number; lon: number; km: number } | null;
  fuente: string;
  actualizado: string;
  onRegionClick: (slug: string) => void;
  onEventoClick: (indice: number) => void;
  onAbrirModal: () => void;
}

const COLOR_RADIO = "var(--accent-600)";

function pathDeForma(polys: [number, number][][][], proy: (lon: number, lat: number) => [number, number]): string {
  const partes: string[] = [];
  for (const poly of polys) {
    for (const anillo of poly) {
      anillo.forEach(([lon, lat], i) => {
        const [x, y] = proy(lon, lat);
        partes.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
      });
      partes.push("Z");
    }
  }
  return partes.join(" ");
}

/**
 * Mapa base del módulo. **No dibuja geografía propia**: sin un GeoJSON cargado
 * por el usuario no hay contornos ni puntos. Con el archivo, sombrea las
 * regiones por cantidad de eventos (gama neutra de cian) y dibuja los puntos
 * con tamaño por magnitud, agrupando los cercanos.
 */
export default function MapaBase({
  geo,
  errorGeo,
  nombreArchivo,
  onCargarArchivo,
  onLimpiarArchivo,
  eventos,
  regiones,
  capa,
  radio,
  fuente,
  actualizado,
  onRegionClick,
  onEventoClick,
  onAbrirModal,
}: MapaBaseProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mostrarRegiones = capa !== "eventos";
  const mostrarEventos = capa !== "regiones";

  const proy = useMemo(() => (geo ? crearProyector(geo.bbox) : null), [geo]);
  const maxEventos = useMemo(() => Math.max(1, ...regiones.map((r) => r.eventos)), [regiones]);
  const conteo = useMemo(() => new Map(regiones.map((r) => [r.slug, r.eventos])), [regiones]);

  const paths = useMemo(
    () => (geo && proy ? geo.formas.map((f) => ({ slug: f.slug, nombre: f.nombre, d: pathDeForma(f.polys, proy) })) : []),
    [geo, proy],
  );

  const puntos = useMemo(() => {
    if (!proy || !mostrarEventos) return [];
    return eventos.map((e, indice) => {
      const [x, y] = proy(e.longitude, e.latitude);
      return { evento: e, indice, x, y };
    });
  }, [proy, mostrarEventos, eventos]);

  const clusters = useMemo(() => agruparPuntos(puntos, 22), [puntos]);

  const circuloRadio = useMemo(() => {
    if (!proy || !radio) return null;
    const dLat = radio.km / 111.0;
    const dLon = radio.km / (111.0 * Math.max(0.05, Math.cos((radio.lat * Math.PI) / 180)));
    const [cx, cy] = proy(radio.lon, radio.lat);
    const [ex] = proy(radio.lon + dLon, radio.lat);
    const [, ey] = proy(radio.lon, radio.lat + dLat);
    return { cx, cy, rx: Math.abs(ex - cx), ry: Math.abs(ey - cy) };
  }, [proy, radio]);

  const abrirSelector = () => inputRef.current?.click();

  /* Sin GeoJSON: no se dibuja ningún contorno ni punto ni un recuadro vacío. */
  if (!geo || !proy) {
    return (
      <div className="self-start rounded-lg border border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-content-muted">
          <span className="flex items-center gap-1.5">
            <IconLayers size={15} />
            Sin capa base. Carga un GeoJSON de departamentos para ver las regiones y ubicar los eventos reportados.
          </span>
          <button
            type="button"
            onClick={abrirSelector}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500"
          >
            <IconUpload size={14} />
            Cargar GeoJSON
          </button>
        </div>
        {errorGeo && (
          <p role="alert" className="mt-2 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-[11px] text-danger">
            <IconAlertTriangle size={13} className="mt-0.5 shrink-0" />
            {errorGeo}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".geojson,.json,application/geo+json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onCargarArchivo(f);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  const totalNoCoinciden = geo.noCoinciden.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-content-muted">
        <span className="flex items-center gap-1.5">
          <IconMapPin size={12} />
          <b className="font-medium text-content-secondary">{nombreArchivo}</b> · {geo.formas.length} de 25 regiones
        </span>
        <button
          type="button"
          onClick={abrirSelector}
          className="rounded-md border border-border px-2 py-0.5 text-[11px] text-content-secondary transition-colors hover:bg-surface-tertiary"
        >
          Cambiar GeoJSON
        </button>
        <button
          type="button"
          onClick={onLimpiarArchivo}
          className="rounded-md border border-border px-2 py-0.5 text-[11px] text-content-secondary transition-colors hover:bg-surface-tertiary"
        >
          Quitar
        </button>
      </div>

      {(totalNoCoinciden > 0 || geo.sinNombre > 0) && (
        <p role="alert" className="mb-2 flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3 py-2 text-[11px] text-content-secondary">
          <IconAlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>
            {totalNoCoinciden > 0 && (
              <>
                {totalNoCoinciden} nombre(s) del archivo no coinciden con los 25 departamentos
                {geo.noCoinciden.length <= 4 ? `: ${geo.noCoinciden.join(", ")}` : ""}.{" "}
              </>
            )}
            {geo.sinNombre > 0 && <>{geo.sinNombre} figura(s) sin propiedad de nombre reconocida. </>}
            Se muestran solo las regiones reconocidas.
          </span>
        </p>
      )}

      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${proy.width} ${proy.height}`}
          role="img"
          aria-label="Mapa de eventos sísmicos sobre regiones"
          className="h-full w-full cursor-zoom-in rounded-lg border border-border bg-white"
          onClick={onAbrirModal}
        >
        {paths.map((p) => {
          const n = conteo.get(p.slug) ?? 0;
          const fill = !mostrarRegiones ? "none" : n > 0 ? escalaCian(n / maxEventos) : SIN_EVENTOS;
          return (
            <path
              key={p.slug}
              d={p.d}
              fill={fill}
              stroke="#94a3b8"
              strokeWidth={0.6}
              className="transition-opacity hover:opacity-80"
              role="button"
              tabIndex={0}
              aria-label={`Región ${p.nombre}: ${n} eventos`}
              onClick={(ev) => {
                ev.stopPropagation();
                onRegionClick(p.slug);
              }}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  onRegionClick(p.slug);
                }
              }}
            >
              <title>{`${p.nombre}: ${n} evento(s)`}</title>
            </path>
          );
        })}

        {circuloRadio && (
          <ellipse
            cx={circuloRadio.cx}
            cy={circuloRadio.cy}
            rx={circuloRadio.rx}
            ry={circuloRadio.ry}
            fill="none"
            stroke={COLOR_RADIO}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}

        {mostrarEventos &&
          clusters.map((c, i) => {
            const unico = c.puntos.length === 1;
            const r = unico ? radioMagnitud(c.puntos[0].evento.magnitude) : 8 + Math.log2(c.puntos.length) * 3;
            return (
              <g
                key={i}
                role="button"
                tabIndex={0}
                aria-label={unico ? `Evento ${c.puntos[0].evento.locality}` : `Grupo de ${c.puntos.length} eventos`}
                className="cursor-pointer"
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (unico) onEventoClick(c.puntos[0].indice);
                  else onAbrirModal();
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    if (unico) onEventoClick(c.puntos[0].indice);
                    else onAbrirModal();
                  }
                }}
              >
                <circle cx={c.x} cy={c.y} r={r} fill={COLOR_PUNTO} fillOpacity={unico ? 0.75 : 0.85} stroke="#ffffff" strokeWidth={1} />
                {!unico && (
                  <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700} fill="#ffffff">
                    {c.puntos.length}
                  </text>
                )}
                <title>
                  {unico
                    ? `${c.puntos[0].evento.locality} · M${c.puntos[0].evento.magnitude.toFixed(1)}`
                    : `${c.puntos.length} eventos en la zona`}
                </title>
              </g>
            );
          })}
      </svg>
      </div>

      <div className="shrink-0">
        <LeyendaMapa
          maxEventos={maxEventos}
          fuente={fuente}
          actualizado={actualizado}
          mostrarRegiones={mostrarRegiones}
          mostrarEventos={mostrarEventos}
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".geojson,.json,application/geo+json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onCargarArchivo(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
