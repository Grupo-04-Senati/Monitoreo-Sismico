/* ════════════════════════════════════════════════════════════════
   Metadatos de la API expuestos a la interfaz.

   Consulta `GET /meta`, aplica el rango real del catálogo al módulo
   `@/lib/ancla` y devuelve la referencia temporal (ISO) para forzar el
   re-render de la vista.
   ════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { apiGet } from "./api";
import { anclaMs, aplicarMeta, type MetaInfo } from "./ancla";

export function useMeta(): string {
  const [iso, setIso] = useState(() => new Date().toISOString());

  useEffect(() => {
    let vivo = true;
    apiGet<MetaInfo>("/meta")
      .then((meta) => {
        aplicarMeta(meta);
        if (vivo) setIso(new Date(anclaMs()).toISOString());
      })
      .catch(() => {
        /* sin metadatos: se mantiene el reloj del navegador */
      });
    return () => {
      vivo = false;
    };
  }, []);

  return iso;
}
