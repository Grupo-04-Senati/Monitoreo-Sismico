import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { parseGeoRegiones } from "../lib/geo";
import type { GeoRegiones } from "../types";

/** Nombre con que se muestra la capa oficial que entrega la API (D24). */
export const CAPA_OFICIAL = "Límites departamentales (INEI)";

/**
 * Capa de regiones del mapa. Al abrir la pantalla se pide la capa oficial a la API
 * (`GET /regions/geojson`). Se puede reemplazar por un GeoJSON local: ese archivo no
 * se sube a ningún servidor, se interpreta en el navegador y vive solo en memoria.
 */
export function useGeoJSON() {
  const [geo, setGeo] = useState<GeoRegiones | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  const cargarOficial = useCallback(async () => {
    try {
      const datos = await apiGet<unknown>("/regions/geojson");
      const parsed = parseGeoRegiones(JSON.stringify(datos));
      if (parsed.formas.length > 0) {
        setGeo(parsed);
        setNombreArchivo(CAPA_OFICIAL);
        setError(null);
      }
    } catch {
      // Sin la capa oficial el mapa ofrece cargar un archivo, como antes.
    }
  }, []);

  useEffect(() => {
    void cargarOficial();
  }, [cargarOficial]);

  const cargar = useCallback(async (file: File) => {
    try {
      const texto = await file.text();
      const parsed = parseGeoRegiones(texto);
      if (parsed.formas.length === 0) {
        setError(
          parsed.noCoinciden.length > 0
            ? "Ninguna región del archivo coincide con los 25 departamentos. Revisa la propiedad del nombre (NOMBDEP, DEPARTAMEN…)."
            : "El archivo no contiene polígonos de regiones reconocibles.",
        );
        return;
      }
      setGeo(parsed);
      setNombreArchivo(file.name);
      setError(null);
    } catch {
      setError("El archivo no es un GeoJSON válido.");
    }
  }, []);

  /** Quita un archivo propio y vuelve a la capa oficial. */
  const limpiar = useCallback(() => {
    setGeo(null);
    setError(null);
    setNombreArchivo(null);
    void cargarOficial();
  }, [cargarOficial]);

  return { geo, error, nombreArchivo, cargar, limpiar };
}
