import { useMemo, useState } from "react";
import type { SeismicEvent } from "@/types";
import { IconReport } from "@/components/ui/Icons";
import { exportFilasCsv } from "@/lib/export";
import TablaDatos from "./TablaDatos";
import { Paginador, SelectorFilas } from "./Controles";
import { COLUMNAS_EVENTOS, filasEventos } from "../lib/tablas";

interface ListaEventosProps {
  eventos: SeismicEvent[];
  maxAltura?: string;
  tamanoInicial?: number;
  /** Ocupa toda la altura disponible del contenedor (panel lateral). */
  fill?: boolean;
}

/**
 * Lista paginada de eventos (barra superior con acciones, paginación arriba y
 * tabla). Se reutiliza dentro del modal de eventos y del panel lateral de la
 * vista ampliada, sin apilar modales.
 */
export default function ListaEventos({ eventos, maxAltura = "max-h-[55vh]", tamanoInicial = 10, fill = false }: ListaEventosProps) {
  const [pagina, setPagina] = useState(0);
  const [tamano, setTamano] = useState(tamanoInicial);

  const filas = useMemo(() => filasEventos(eventos), [eventos]);
  const inicio = pagina * tamano;
  const filasPagina = filas.slice(inicio, inicio + tamano);

  return (
    <div className={fill ? "flex h-full min-h-0 flex-col" : undefined}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-content-muted">{eventos.length.toLocaleString("es-PE")} eventos</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportFilasCsv(COLUMNAS_EVENTOS.map((c) => c.etiqueta), filas, "eventos_seleccion.csv")}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-content-secondary transition-colors hover:bg-surface-tertiary"
          >
            <IconReport size={13} />
            CSV
          </button>
          <SelectorFilas
            tamano={tamano}
            onCambiar={(n) => {
              setTamano(n);
              setPagina(0);
            }}
          />
        </div>
      </div>
      <Paginador total={filas.length} pagina={pagina} tamano={tamano} onPagina={setPagina} />
      <TablaDatos columnas={COLUMNAS_EVENTOS} filas={filasPagina} desde={inicio} maxAltura={maxAltura} fill={fill} />
    </div>
  );
}
