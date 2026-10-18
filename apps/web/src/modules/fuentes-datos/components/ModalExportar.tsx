import { useState } from "react";
import type { FormatoExport, ParteExportId } from "../services/fuentes.service";
import { PARTES_EXPORT } from "../services/fuentes.service";
import ExpandModal from "@/components/ui/ExpandModal";
import { IconCheck, IconDownload, IconInfo } from "@/components/ui/Icons";

interface ModalExportarProps {
  /** Partes preseleccionadas al abrir el modal. */
  iniciales: ParteExportId[];
  onCerrar: () => void;
  onDescargar: (ids: ParteExportId[], formato: FormatoExport) => void;
  onCopiar: (ids: ParteExportId[]) => Promise<boolean>;
}

/**
 * Exportación por partes: el usuario elige qué bloques incluir y el formato.
 * CSV entrega un archivo con todos los bloques; Excel entrega una hoja por parte.
 */
export default function ModalExportar({ iniciales, onCerrar, onDescargar, onCopiar }: ModalExportarProps) {
  const [sel, setSel] = useState<Set<ParteExportId>>(() => new Set(iniciales));
  const [formato, setFormato] = useState<FormatoExport>("xlsx");
  const [copiado, setCopiado] = useState(false);

  const alternar = (id: ParteExportId) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const ids = PARTES_EXPORT.filter((p) => sel.has(p.id)).map((p) => p.id);
  const vacio = ids.length === 0;

  const copiar = async () => {
    if (vacio) return;
    const ok = await onCopiar(ids);
    if (ok) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  const pie = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-content-muted">
        {ids.length} de {PARTES_EXPORT.length} partes
      </span>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={copiar}
          disabled={vacio}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copiado ? <IconCheck size={13} /> : null}
          {copiado ? "Copiado" : "Copiar al portapapeles"}
        </button>
        <button
          type="button"
          onClick={() => !vacio && onDescargar(ids, formato)}
          disabled={vacio}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconDownload size={13} />
          Descargar {formato === "xlsx" ? "Excel" : "CSV"}
        </button>
      </div>
    </div>
  );

  return (
    <ExpandModal title="Exportar datos" onClose={onCerrar} footer={pie} resizable>
      <p role="note" className="flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2 text-[11px] leading-relaxed text-content-secondary">
        <IconInfo size={13} className="mt-0.5 shrink-0" />
        <span>
          Elige las partes y el formato. <b className="font-semibold text-content">CSV</b> genera un archivo con todos los
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
              </label>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px]">
            <button
              type="button"
              onClick={() => setSel(new Set(PARTES_EXPORT.map((p) => p.id)))}
              className="text-accent-600 hover:underline"
            >
              Seleccionar todo
            </button>
            <button type="button" onClick={() => setSel(new Set())} className="text-content-muted hover:text-content">
              Quitar todo
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">Formato</legend>
          <div className="mt-2 flex flex-col gap-2">
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
                <span className="block text-[11px] text-content-muted">Una hoja por cada parte seleccionada.</span>
              </span>
            </label>
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
                <span className="block text-[11px] text-content-muted">Un solo archivo con los bloques seleccionados.</span>
              </span>
            </label>
          </div>
        </fieldset>
      </div>
    </ExpandModal>
  );
}
