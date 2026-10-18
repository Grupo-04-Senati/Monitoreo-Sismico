import { useState } from "react";
import type { AlcanceExport, FormatoExport } from "../services/eventos.service";
import ExpandModal from "@/components/ui/ExpandModal";
import { IconDownload, IconInfo } from "@/components/ui/Icons";

interface ModalExportarProps {
  totalFiltrados: number;
  totalCatalogo: number;
  onCerrar: () => void;
  onDescargar: (alcance: AlcanceExport, formato: FormatoExport) => void;
}

/** Exportación de eventos: alcance (filtrados o todo el catálogo) y formato. */
export default function ModalExportar({ totalFiltrados, totalCatalogo, onCerrar, onDescargar }: ModalExportarProps) {
  const [alcance, setAlcance] = useState<AlcanceExport>("filtrados");
  const [formato, setFormato] = useState<FormatoExport>("csv");

  const n = alcance === "filtrados" ? totalFiltrados : totalCatalogo;

  const pie = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-content-muted">{n.toLocaleString("es-PE")} evento(s) a exportar</span>
      <button
        type="button"
        onClick={() => onDescargar(alcance, formato)}
        disabled={n === 0}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <IconDownload size={13} />
        Descargar {formato === "xlsx" ? "Excel" : "CSV"}
      </button>
    </div>
  );

  return (
    <ExpandModal title="Exportar eventos" onClose={onCerrar} footer={pie} resizable>
      <p
        role="note"
        className="flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2 text-[11px] leading-relaxed text-content-secondary"
      >
        <IconInfo size={13} className="mt-0.5 shrink-0" />
        <span>
          Se exportan los campos visibles del catálogo (fecha, localidad, magnitud, profundidad, procedencia). Los
          eventos son observaciones de la fuente y pueden ser corregidos.
        </span>
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <fieldset>
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">Alcance</legend>
          <div className="mt-2 flex flex-col gap-2">
            <label className="flex items-start gap-2 text-xs text-content-secondary">
              <input
                type="radio"
                name="alcance-export"
                checked={alcance === "filtrados"}
                onChange={() => setAlcance("filtrados")}
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent-500)]"
              />
              <span>
                <b className="font-semibold text-content">Solo los filtrados</b>
                <span className="block text-[11px] text-content-muted">{totalFiltrados.toLocaleString("es-PE")} evento(s) con los filtros activos.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-content-secondary">
              <input
                type="radio"
                name="alcance-export"
                checked={alcance === "catalogo"}
                onChange={() => setAlcance("catalogo")}
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent-500)]"
              />
              <span>
                <b className="font-semibold text-content">Todo el catálogo</b>
                <span className="block text-[11px] text-content-muted">{totalCatalogo.toLocaleString("es-PE")} evento(s) sin aplicar filtros.</span>
              </span>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">Formato</legend>
          <div className="mt-2 flex flex-col gap-2">
            <label className="flex items-start gap-2 text-xs text-content-secondary">
              <input
                type="radio"
                name="formato-export"
                checked={formato === "csv"}
                onChange={() => setFormato("csv")}
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent-500)]"
              />
              <span>
                <b className="font-semibold text-content">CSV (.csv)</b>
                <span className="block text-[11px] text-content-muted">Texto separado por punto y coma, con BOM para Excel.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-content-secondary">
              <input
                type="radio"
                name="formato-export"
                checked={formato === "xlsx"}
                onChange={() => setFormato("xlsx")}
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent-500)]"
              />
              <span>
                <b className="font-semibold text-content">Excel (.xlsx)</b>
                <span className="block text-[11px] text-content-muted">Una hoja con todos los eventos.</span>
              </span>
            </label>
          </div>
        </fieldset>
      </div>
    </ExpandModal>
  );
}
