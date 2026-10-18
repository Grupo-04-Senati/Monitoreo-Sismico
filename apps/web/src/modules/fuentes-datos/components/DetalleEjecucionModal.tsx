import type { EjecucionFuente } from "../types";
import ExpandModal from "@/components/ui/ExpandModal";
import DetalleEjecucion from "./DetalleEjecucion";

interface DetalleEjecucionModalProps {
  ejecucion: EjecucionFuente;
  posicion: number;
  total: number;
  hayAnterior: boolean;
  haySiguiente: boolean;
  onCerrar: () => void;
  onAnterior: () => void;
  onSiguiente: () => void;
}

/** Detalle de una ejecución de la ingesta (modal independiente). */
export default function DetalleEjecucionModal({
  ejecucion,
  posicion,
  total,
  hayAnterior,
  haySiguiente,
  onCerrar,
  onAnterior,
  onSiguiente,
}: DetalleEjecucionModalProps) {
  return (
    <ExpandModal title={`Ejecución ${ejecucion.id}`} onClose={onCerrar} resizable>
      <DetalleEjecucion
        ejecucion={ejecucion}
        posicion={posicion}
        total={total}
        hayAnterior={hayAnterior}
        haySiguiente={haySiguiente}
        onAnterior={onAnterior}
        onSiguiente={onSiguiente}
      />
    </ExpandModal>
  );
}
