import { useState } from "react";
import { fmtDateTimeUTC5 } from "@/lib/format";
import type { Parametro } from "../types";

interface TarjetaParametroProps {
  parametro: Parametro;
  guardando: boolean;
  onGuardar: (p: Parametro, valor: number) => void;
}

/** Un parámetro editable: valor, rango, efecto real y último cambio. */
export default function TarjetaParametro({ parametro: p, guardando, onGuardar }: TarjetaParametroProps) {
  const [texto, setTexto] = useState(String(p.valor));
  const n = Number(texto);
  const valido = texto.trim() !== "" && Number.isInteger(n) && n >= p.minimo && n <= p.maximo;
  const cambiado = valido && n !== p.valor;

  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-content-muted">{p.grupo}</p>
      <h3 className="mt-0.5 text-sm font-semibold text-content">{p.etiqueta}</h3>
      <p className="mt-1 text-xs text-content-secondary">{p.descripcion}</p>

      <div className="mt-3 flex items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-content-secondary">Valor ({p.unidad})</span>
          <input
            inputMode="numeric"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && cambiado) onGuardar(p, n);
            }}
            aria-invalid={!valido}
            className={`w-28 rounded-md border bg-surface px-2.5 py-1.5 text-sm font-semibold text-content focus:outline-none ${
              valido ? "border-border focus:border-accent-500" : "border-slate-500"
            }`}
          />
        </label>
        <button
          type="button"
          onClick={() => onGuardar(p, n)}
          disabled={!cambiado || guardando}
          className="rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        {texto !== String(p.valor) && (
          <button type="button" onClick={() => setTexto(String(p.valor))} className="text-xs text-content-secondary underline">
            Deshacer
          </button>
        )}
      </div>
      <p className={`mt-1 text-[11px] ${valido ? "text-content-muted" : "font-medium text-content"}`}>
        Rango {p.minimo}–{p.maximo} {p.unidad} · por defecto {p.defecto}
        {p.personalizado && p.valor !== p.defecto && (
          <button type="button" onClick={() => setTexto(String(p.defecto))} className="ml-1 underline">
            usar el valor por defecto
          </button>
        )}
      </p>

      <p className="mt-3 border-t border-border pt-2 text-[11px] text-content-secondary">
        <b className="font-medium text-content">Efecto:</b> {p.efecto}
      </p>
      <p className="mt-1 text-[11px] text-content-muted">
        {p.actualizado_en
          ? `Último cambio: ${fmtDateTimeUTC5(p.actualizado_en)}${p.actualizado_por ? ` · ${p.actualizado_por}` : ""}`
          : "Sin cambios: rige el valor por defecto."}
      </p>
    </div>
  );
}
