import { useState } from "react";
import type { FormatoExport, ParteMapa } from "../services/mapa.service";
import { PARTES_EXPORT } from "../services/mapa.service";
import ExpandModal from "@/components/ui/ExpandModal";
import { IconDownload, IconInfo } from "@/components/ui/Icons";

interface ModalExportarMapaProps {
  iniciales: ParteMapa[];
  totalRegiones: number;
  totalEventos: number;
  onCerrar: () => void;
  onDescargar: (partes: ParteMapa[], formato: FormatoExport) => void;
}

/** Exportación por partes del mapa: regiones y/o eventos, en CSV o Excel. */
export default function ModalExportarMapa({ iniciales, totalRegiones, totalEventos, onCerrar, onDescargar }: ModalExportarMapaProps) {
  const [sel, setSel] = useState<Set<ParteMapa>>(() => new Set(iniciales));
  const [formato, setFormato] = useState<FormatoExport>("xlsx");

  const alternar = (id: ParteMapa) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const ids = PARTES_EXPORT.filter((p) => sel.has(p.id)).map((p) => p.id);
  const vacio = ids.length === 0;

  const conteo = (id: ParteMapa) => (id === "regiones" ? `${totalRegiones} filas` : `${totalEventos} eventos`);

  const pie = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-content-muted">{ids.length} de {PARTES_EXPORT.length} partes</span>
      <button
        type="button"
        onClick={() => !vacio && onDescargar(ids, formato)}
        disabled={vacio}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <IconDownload size={13} />
        Descargar {formato === "xlsx" ? "Excel" : "CSV"}
      </button>
    </div>
  );

  return (
    <ExpandModal title="Exportar mapa" onClose={onCerrar} footer={pie} resizable>
      <p
        role="note"
        className="flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2 text-[11px] leading-relaxed text-content-secondary"
      >
        <IconInfo size={13} className="mt-0.5 shrink-0" />
        <span>
          Elige las partes y el formato. <b className="font-semibold text-content">CSV</b> genera un archivo con los
          bloques seleccionados; <b className="font-semibold text-content">Excel</b> genera una hoja por parte.
        </span>
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <fieldset>
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">Partes</legend>
          <div className="mt-2 flex flex-col gap-1.5">
            {PARTES_EXPORT.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-xs text-content-secondary">
                <input
                  type="checkbox"
                  checked={sel.has(p.id)}
                  onChange={() => alternar(p.id)}
                  className="h-3.5 w-3.5 accent-[var(--accent-500)]"
                />
                {p.label}
                <span className="text-[11px] text-content-muted">({conteo(p.id)})</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">Formato</legend>
          <div className="mt-2 flex flex-col gap-2">
            <label className="flex items-start gap-2 text-xs text-content-secondary">
              <input
                type="radio"
                name="formato-mapa"
                checked={formato === "xlsx"}
                onChange={() => setFormato("xlsx")}
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent-500)]"
              />
              <span>
                <b className="font-semibold text-content">Excel (.xlsx)</b>
                <span className="block text-[11px] text-content-muted">Una hoja por cada parte seleccionada.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-content-secondary">
              <input
                type="radio"
                name="formato-mapa"
                checked={formato === "csv"}
                onChange={() => setFormato("csv")}
                className="mt-0.5 h-3.5 w-3.5 accent-[var(--accent-500)]"
              />
              <span>
                <b className="font-semibold text-content">CSV (.csv)</b>
                <span className="block text-[11px] text-content-muted">Un archivo con los bloques seleccionados.</span>
              </span>
            </label>
          </div>
        </fieldset>
      </div>
    </ExpandModal>
  );
}
