import { IconInfo } from "@/components/ui/Icons";

/**
 * Aviso fijo del módulo: recuerda que los informes son reproducibles, que el
 * enlace de descarga expira y que nunca incluyen secretos.
 */
export default function AvisoReportes() {
  return (
    <div
      role="note"
      className="mb-3 flex items-start gap-2 rounded-lg border border-border border-l-2 border-l-accent-600 bg-surface px-3.5 py-2.5 text-[11px] leading-relaxed text-content-secondary"
    >
      <IconInfo size={14} className="mt-0.5 shrink-0 text-accent-600" />
      <span>
        Cada informe guarda su <b className="font-semibold text-content">fecha de corte</b> y sus filtros, por lo que es{" "}
        <b className="font-semibold text-content">reproducible</b>. El enlace de descarga{" "}
        <b className="font-semibold text-content">expira</b> y solo puede abrirlo quien lo solicitó o un Administrador.
        Ningún informe incluye credenciales ni secretos. Los informes de <b className="font-semibold text-content">Modelos ML</b>{" "}
        y <b className="font-semibold text-content">Alertas</b> aparecerán cuando esos módulos estén disponibles.
      </span>
    </div>
  );
}
