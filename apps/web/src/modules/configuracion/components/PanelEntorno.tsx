import Card from "@/components/ui/Card";
import { IconAlertTriangle } from "@/components/ui/Icons";
import type { Entorno } from "../types";

const siNo = (v: boolean) => (v ? "Sí" : "No");

/** Variables de entorno relevantes, en solo lectura y sin secretos. */
export default function PanelEntorno({ entorno: e }: { entorno: Entorno }) {
  const filas: [string, string][] = [
    ["Entorno", e.entorno],
    ["Fuentes activas", e.fuentes_activas.join(", ") || "Ninguna"],
    ["Orígenes permitidos (CORS)", e.origenes_cors.join(", ") || "—"],
    ["Cookies seguras (HTTPS)", siNo(e.cookies_seguras)],
    ["Duración de la sesión", `${e.sesion_minutos} min por token de acceso`],
    [
      "Correo de avisos",
      e.correo.activado ? (e.correo.configurado ? "Activado y configurado" : "Activado, pero incompleto") : "Desactivado (entregas “simuladas”)",
    ],
    ["Servidor SMTP", e.correo.servidor ?? "—"],
    ["Remitente", e.correo.remitente ?? "—"],
    ["Bloqueo de acceso", `${e.acceso.intentos_antes_de_bloqueo} intentos fallidos → ${e.acceso.bloqueo_minutos} min`],
    ["Límite por IP", `${e.acceso.intentos_por_ip_por_minuto} intentos por minuto`],
    ["Conteo de intentos", e.acceso.almacen === "redis" ? "Redis (compartido entre procesos)" : "Memoria del proceso"],
  ];

  return (
    <Card title="Entorno del servidor" help="Se cambia en el archivo .env del servidor y requiere reiniciar la API. Nunca se muestran secretos.">
      {e.advertencias.length > 0 && (
        <div className="mb-3 rounded-lg border border-border border-l-2 border-l-slate-500 bg-surface-secondary px-3 py-2.5">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-content">
            <IconAlertTriangle size={13} /> Revisar ({e.advertencias.length})
          </p>
          <ul className="list-disc space-y-0.5 pl-5 text-[11px] text-content-secondary">
            {e.advertencias.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
        {filas.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-content-secondary">{k}</dt>
            <dd className="break-words font-medium text-content">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-content-muted">Solo lectura: se cambia en el archivo .env del servidor.</p>
    </Card>
  );
}
