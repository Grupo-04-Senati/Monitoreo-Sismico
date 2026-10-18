import type { SeismicEvent } from "@/types";
import ExpandModal from "@/components/ui/ExpandModal";
import ListaEventos from "./ListaEventos";

interface PanelEventosProps {
  titulo: string;
  info: string;
  eventos: SeismicEvent[];
  meta: string;
  onCerrar: () => void;
}

/** Lista de eventos que componen una barra o un punto del gráfico. */
export default function PanelEventos({ titulo, info, eventos, meta, onCerrar }: PanelEventosProps) {
  const pie = `${meta} · n=${eventos.length}`;
  return (
    <ExpandModal title={titulo} onClose={onCerrar} footer={pie} resizable>
      <p className="mb-3 text-[11px] text-content-muted">{info}</p>
      <div className="flex flex-1 min-h-0 flex-col">
        <ListaEventos eventos={eventos} fill />
      </div>
    </ExpandModal>
  );
}
