import { IconLayers, IconMapPin } from "@/components/ui/Icons";

interface MapaEventoProps {
  latitude: number;
  longitude: number;
  /**
   * Capa base del mapa. Hoy no hay proveedor de mapas conectado, por eso el
   * recuadro se muestra en blanco con la nota "Capa base pendiente".
   * Ver `src/modules/eventos/README.md` para conectarla.
   */
  baseLayer?: boolean;
}

/**
 * Recuadro de mapa del detalle del evento. No dibuja geografía: solo reserva
 * el espacio de la capa base y muestra las coordenadas en texto.
 */
export default function MapaEvento({ latitude, longitude, baseLayer = false }: MapaEventoProps) {
  return (
    <figure className="m-0">
      <div className="relative grid aspect-[16/9] place-items-center overflow-hidden rounded-lg border border-border bg-white">
        {!baseLayer && (
          <div className="px-4 text-center">
            <IconLayers size={22} className="mx-auto text-slate-400" />
            <p className="mt-1.5 text-xs font-semibold text-slate-600">Capa base pendiente</p>
            <p className="text-[11px] text-slate-500">Aún no se ha conectado un proveedor de mapas.</p>
          </div>
        )}
      </div>
      <figcaption className="mt-1.5 flex items-center gap-1.5 text-[11px] text-content-muted">
        <IconMapPin size={12} />
        Coordenadas: {latitude.toFixed(4)}, {longitude.toFixed(4)} (lat, lon) · referencia aproximada
      </figcaption>
    </figure>
  );
}
