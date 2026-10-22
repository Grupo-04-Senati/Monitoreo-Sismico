import { useEffect, useState } from "react";
import type { CalidadCampo } from "@/types";
import { resumenCalidadGlobal, type CalidadGlobal } from "@/lib/calidad";
import { apiGet } from "@/lib/api";

/* ════════════════════════════════════════════════════════════════
   Indicador "Calidad de datos" del Dashboard.

   Usa la MISMA función (`lib/calidad.ts`) y la MISMA selección que la
   tabla de calidad de Fuentes: el catálogo de eventos de la fuente.
   Toma los datos reales de `GET /sources/{id}/quality` y las
   ejecuciones (`/runs`) para el porcentaje de duplicados.
   ════════════════════════════════════════════════════════════════ */

interface QualityAPI {
  campos: { campo: string; nulos: number; porcentaje_nulos: number }[];
  total_eventos: number;
}

interface RunsPageAPI {
  items: { records_read: number; duplicates_skipped: number }[];
  total_paginas: number;
}

export interface CalidadDatos {
  global: CalidadGlobal;
  campos: CalidadCampo[];
}

/** `habilitado` = el rol puede ver Fuentes de datos; si no, no se consulta (respondería 403). */
export function useCalidadDatos(habilitado = true): CalidadDatos | null {
  const [datos, setDatos] = useState<CalidadDatos | null>(null);

  useEffect(() => {
    let vivo = true;
    if (!habilitado) return;
    (async () => {
      const { items } = await apiGet<{ items: { id: string }[] }>("/sources");
      const id = items[0]?.id;
      if (!id) return;
      const quality = await apiGet<QualityAPI>(`/sources/${id}/quality`);

      let duplicados = 0;
      let leidos = 0;
      let pagina = 1;
      for (;;) {
        const p = await apiGet<RunsPageAPI>(`/sources/${id}/runs?pagina=${pagina}&tamano=100`);
        for (const r of p.items) {
          duplicados += r.duplicates_skipped;
          leidos += r.records_read;
        }
        if (pagina >= p.total_paginas || p.items.length === 0) break;
        pagina += 1;
      }

      const campos: CalidadCampo[] = quality.campos.map((c) => ({
        campo: c.campo,
        nulos: c.nulos,
        total: quality.total_eventos,
        pctNulos: c.porcentaje_nulos,
        valorEjemplo: "",
        observacion: null,
      }));
      if (vivo) setDatos({ global: resumenCalidadGlobal(campos, duplicados, leidos), campos });
    })().catch(() => undefined);

    return () => {
      vivo = false;
    };
  }, [habilitado]);

  return datos;
}
