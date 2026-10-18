import { useState } from "react";
import type { ResultadoSincronizacion } from "../services/fuentes.service";
import ExpandModal from "@/components/ui/ExpandModal";
import { IconCheck, IconClock, IconZap } from "@/components/ui/Icons";

interface ModalSincronizarProps {
  onCerrar: () => void;
  onSincronizar: () => Promise<ResultadoSincronizacion>;
}

type Fase = "confirmar" | "enviando" | "listo";

const btnBase =
  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** Confirmación de sincronización manual (solo Administrador). */
export default function ModalSincronizar({ onCerrar, onSincronizar }: ModalSincronizarProps) {
  const [fase, setFase] = useState<Fase>("confirmar");
  const [resultado, setResultado] = useState<ResultadoSincronizacion | null>(null);

  const ejecutar = async () => {
    setFase("enviando");
    const res = await onSincronizar();
    setResultado(res);
    setFase("listo");
  };

  const pie =
    fase === "confirmar" ? (
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCerrar} className={`${btnBase} border border-border text-content-secondary hover:bg-surface-tertiary`}>
          Cancelar
        </button>
        <button type="button" onClick={ejecutar} className={`${btnBase} bg-accent-600 text-white hover:bg-accent-500`}>
          <IconZap size={13} />
          Sincronizar ahora
        </button>
      </div>
    ) : fase === "listo" ? (
      <div className="flex items-center justify-end">
        <button type="button" onClick={onCerrar} className={`${btnBase} border border-border text-content-secondary hover:bg-surface-tertiary`}>
          Cerrar
        </button>
      </div>
    ) : undefined;

  return (
    <ExpandModal title="Sincronización manual" onClose={onCerrar} footer={pie} resizable>
      {fase === "confirmar" && (
        <div className="max-w-lg text-sm text-content-secondary">
          <p className="flex items-start gap-2.5">
            <IconZap size={16} className="mt-0.5 shrink-0 text-accent-600" />
            Se solicitará una ingesta inmediata al proveedor, además del ciclo programado cada 15 min.
          </p>
          <p className="mt-3 rounded-lg border border-border bg-surface-secondary px-3.5 py-2 text-[11px] leading-relaxed">
            La ingesta es <b className="font-semibold text-content">idempotente</b>: reprocesar la misma ventana no duplica
            eventos. La acción quedará registrada en <b className="font-semibold text-content">Auditoría</b>.
          </p>
        </div>
      )}

      {fase === "enviando" && (
        <p className="flex items-center gap-2.5 text-sm text-content-secondary" role="status">
          <IconClock size={16} className="text-accent-600" />
          Sincronizando con la fuente…
        </p>
      )}

      {fase === "listo" && resultado && (
        <div className="text-sm" role="status">
          <p className="flex items-center gap-2 font-medium text-content">
            <IconCheck size={16} className="text-success" />
            Sincronización completada
          </p>
          <ul className="mt-2.5 space-y-1 text-xs text-content-secondary">
            <li>
              Ejecución: <code className="font-mono text-[11px] text-content">{resultado.id}</code>
            </li>
            <li>
              Insertados: <b className="font-semibold text-content">{resultado.insertados}</b> · Duplicados omitidos:{" "}
              <b className="font-semibold text-content">{resultado.duplicadosOmitidos}</b>
            </li>
          </ul>
        </div>
      )}
    </ExpandModal>
  );
}
