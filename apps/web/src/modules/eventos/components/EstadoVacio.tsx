import type { ReactNode } from "react";

interface EstadoVacioProps {
  titulo: string;
  descripcion?: string;
  /** Icono decorativo; si no se indica, no se muestra ninguno. */
  icono?: ReactNode;
  /** Acción principal (p. ej. "Limpiar filtros" o "Reintentar"). */
  accion?: ReactNode;
  tono?: "neutral" | "error";
}

/** Estado vacío / de error compartido por la tabla de eventos. */
export default function EstadoVacio({ titulo, descripcion, icono, accion, tono = "neutral" }: EstadoVacioProps) {
  return (
    <div
      className="auth-surface bg-surface border border-border rounded-lg px-6 py-14 text-center"
      role={tono === "error" ? "alert" : "status"}
    >
      {icono && <div className="mb-3 flex justify-center text-content-muted">{icono}</div>}
      <p className="text-sm font-semibold text-content">{titulo}</p>
      {descripcion && <p className="mx-auto mt-1 max-w-md text-xs text-content-muted">{descripcion}</p>}
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  );
}
