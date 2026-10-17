import { IconChevronRight } from "@/components/ui/Icons";

const TERMINOS: { termino: string; definicion: string }[] = [
  {
    termino: "Evento observado",
    definicion:
      "Registro de un sismo reportado por la fuente. Puede ser revisado o corregido y no constituye un comunicado oficial.",
  },
  {
    termino: "Pendiente de validación",
    definicion: "El proveedor todavía no ha confirmado el evento; sus datos (magnitud, profundidad, ubicación) pueden cambiar.",
  },
  {
    termino: "Mw / ML / mb",
    definicion:
      "Mw: magnitud de momento. ML: magnitud local. mb: magnitud de ondas de cuerpo. Son escalas distintas y no siempre comparables entre sí.",
  },
  {
    termino: "Profundidad",
    definicion: "Distancia del hipocentro a la superficie, en kilómetros. Los sismos superficiales suelen sentirse más.",
  },
  {
    termino: "Hora (UTC-5 / UTC)",
    definicion: "La tabla usa la hora de Perú (UTC-5). El detalle del evento muestra también la hora UTC.",
  },
  {
    termino: "Alcance de esta pantalla",
    definicion:
      "Muestra eventos observados del catálogo según los filtros de consulta. No son alertas oficiales ni predicciones.",
  },
];

/** Glosario plegable con los términos usados en el módulo. */
export default function Glosario() {
  return (
    <details className="group mt-4 rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-content">
        <IconChevronRight size={14} className="transition-transform group-open:rotate-90" />
        Glosario y alcance
      </summary>
      <dl className="border-t border-border px-3.5 py-1.5">
        {TERMINOS.map((t) => (
          <div key={t.termino} className="border-b border-border py-2 last:border-0">
            <dt className="text-[12px] font-semibold text-content">{t.termino}</dt>
            <dd className="mt-0.5 text-[12px] leading-relaxed text-content-secondary">{t.definicion}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
