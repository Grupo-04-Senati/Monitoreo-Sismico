import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { slugify } from "@/lib/format";
import type { GeoRegiones } from "../types";
import { SIN_EVENTOS, crearProyector, escalaCian, parseGeoRegiones, pathDePoligonos } from "../lib/geo";
import PlanisferioSvg from "./PlanisferioSvg";
import { cargarPaises, cargarSismosMundo, type PaisMundo, type RespuestaMundo } from "../services/mundo.service";

let _peru: Promise<GeoRegiones> | null = null;
function capaPeru(): Promise<GeoRegiones> {
  if (!_peru) {
    _peru = apiGet<unknown>("/regions/geojson")
      .then((d) => parseGeoRegiones(JSON.stringify(d)))
      .catch((e) => {
        _peru = null;
        throw e;
      });
  }
  return _peru;
}

const Mensaje = ({ texto }: { texto: string }) => (
  <div className="flex h-full items-center justify-center px-4 text-center text-xs text-content-muted">{texto}</div>
);

/**
 * Mapa pequeño del Dashboard. "peru": departamentos sombreados según los sismos del periodo
 * (los mismos filtros de la tarjeta). "mundo": sismos M4.5+ de los últimos 7 días en vivo (D30).
 * Solo se mira: el detalle y los filtros están en el módulo Mapa sísmico.
 */
export default function MiniMapa({
  vista,
  regiones,
  onMundo,
}: {
  vista: "peru" | "mundo";
  /** Región de cada sismo del periodo (vista Perú). */
  regiones: string[];
  /** Avisa cuántos sismos del mundo se dibujaron (para el pie de la tarjeta). */
  onMundo?: (datos: RespuestaMundo | null) => void;
}) {
  const [peru, setPeru] = useState<GeoRegiones | null>(null);
  const [paises, setPaises] = useState<PaisMundo[] | null>(null);
  const [mundo, setMundo] = useState<RespuestaMundo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setError(null);
    if (vista === "peru") {
      capaPeru()
        .then((g) => vivo && setPeru(g))
        .catch(() => vivo && setError("No se pudo cargar la capa de departamentos."));
    } else {
      Promise.all([cargarPaises(), cargarSismosMundo("semana")])
        .then(([p, d]) => {
          if (!vivo) return;
          setPaises(p);
          setMundo(d);
          onMundo?.(d);
        })
        .catch(() => {
          if (!vivo) return;
          setError("La vista mundial no está disponible ahora (el USGS no respondió).");
          onMundo?.(null);
        });
    }
    return () => {
      vivo = false;
    };
    // onMundo es un callback del padre: no debe volver a pedir los datos.
  }, [vista]);

  const proyPeru = useMemo(() => (peru ? crearProyector(peru.bbox, 600, 0.03) : null), [peru]);
  const conteo = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of regiones) if (r) m.set(slugify(r), (m.get(slugify(r)) ?? 0) + 1);
    return m;
  }, [regiones]);
  const maximo = Math.max(1, ...conteo.values());

  if (error) return <Mensaje texto={error} />;

  if (vista === "mundo") {
    if (!paises || !mundo) return <Mensaje texto="Cargando el planisferio…" />;
    return <PlanisferioSvg paises={paises} sismos={mundo.items} compacto />;
  }

  if (!peru || !proyPeru) return <Mensaje texto="Cargando el mapa del Perú…" />;
  return (
    <svg
      viewBox={`0 0 ${proyPeru.width} ${proyPeru.height}`}
      role="img"
      aria-label={`Departamentos del Perú sombreados por número de sismos: ${conteo.size} con eventos`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {peru.formas.map((f) => {
        const n = conteo.get(f.slug) ?? 0;
        return (
          <path key={f.slug} d={pathDePoligonos(f.polys, proyPeru)} fill={n > 0 ? escalaCian(n / maximo) : SIN_EVENTOS} stroke="#94a3b8" strokeWidth={0.6}>
            <title>{`${f.nombre}: ${n} evento(s)`}</title>
          </path>
        );
      })}
    </svg>
  );
}
