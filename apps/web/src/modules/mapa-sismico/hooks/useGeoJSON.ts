import { useCallback, useState } from "react";
import { parseGeoRegiones } from "../lib/geo";
import type { GeoRegiones } from "../types";

/**
 * Carga un GeoJSON de regiones desde un archivo local. El archivo no se sube a
 * ningún servidor: se interpreta en el navegador y vive solo en memoria.
 */
export function useGeoJSON() {
  const [geo, setGeo] = useState<GeoRegiones | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  const cargar = useCallback(async (file: File) => {
    try {
      const texto = await file.text();
      const parsed = parseGeoRegiones(texto);
      if (parsed.formas.length === 0) {
        setGeo(null);
        setError(
          parsed.noCoinciden.length > 0
            ? "Ninguna región del archivo coincide con los 25 departamentos. Revisa la propiedad del nombre (NOMBDEP, DEPARTAMEN…)."
            : "El archivo no contiene polígonos de regiones reconocibles.",
        );
        setNombreArchivo(null);
        return;
      }
      setGeo(parsed);
      setNombreArchivo(file.name);
      setError(null);
    } catch {
      setGeo(null);
      setNombreArchivo(null);
      setError("El archivo no es un GeoJSON válido.");
    }
  }, []);

  const limpiar = useCallback(() => {
    setGeo(null);
    setError(null);
    setNombreArchivo(null);
  }, []);

  return { geo, error, nombreArchivo, cargar, limpiar };
}
