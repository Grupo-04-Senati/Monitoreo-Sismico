import type { Columna } from "../types";

interface TablaDatosProps {
  columnas: Columna[];
  filas: (string | number)[][];
  /** Índice (absoluto) de la primera fila mostrada, para onFila. */
  desde?: number;
  onFila?: (indice: number) => void;
  maxAltura?: string;
  /** Ocupa toda la altura disponible del contenedor (panel lateral). */
  fill?: boolean;
  vacio?: string;
}

/** Tabla reutilizable para el resumen estadístico, los eventos y los modales. */
export default function TablaDatos({
  columnas,
  filas,
  desde = 0,
  onFila,
  maxAltura = "max-h-[420px]",
  fill = false,
  vacio = "Sin datos para estos filtros.",
}: TablaDatosProps) {
  return (
    <div className={`chart-plot overflow-auto rounded-lg ${fill ? "flex-1 min-h-0" : maxAltura}`}>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th
                key={c.clave}
                className={`sticky top-0 z-10 whitespace-nowrap border-b border-border bg-surface-tertiary px-3 py-2 font-medium text-content-muted ${
                  c.numerica ? "text-right" : "text-left"
                }`}
              >
                {c.etiqueta}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 ? (
            <tr>
              <td colSpan={columnas.length} className="px-3 py-8 text-center text-content-muted">
                {vacio}
              </td>
            </tr>
          ) : (
            filas.map((fila, i) => (
              <tr
                key={desde + i}
                className={`border-b border-border last:border-0 ${
                  onFila ? "cursor-pointer hover:bg-surface-tertiary" : ""
                }`}
                onClick={onFila ? () => onFila(desde + i) : undefined}
              >
                {fila.map((v, j) => (
                  <td
                    key={j}
                    className={`whitespace-nowrap px-3 py-1.5 ${
                      columnas[j]?.numerica ? "text-right tabular-nums" : ""
                    } text-content-secondary`}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
