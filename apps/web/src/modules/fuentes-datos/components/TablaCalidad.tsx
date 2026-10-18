import type { CalidadCampo } from "../types";
import Card from "@/components/ui/Card";
import DataTable from "@/components/ui/DataTable";
import { IconExpand } from "@/components/ui/Icons";

/** Escala de la barra: 0–10 % de nulos. */
const MAX_PCT = 10;

function BarraNulos({ pct, nulos, total }: { pct: number; nulos: number; total: number }) {
  const ancho = Math.min(100, (pct / MAX_PCT) * 100);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-tertiary" aria-hidden="true">
        <span className="block h-full rounded-full bg-accent-500" style={{ width: `${ancho}%` }} />
      </span>
      <span className="w-12 text-right tabular-nums text-content-secondary">{pct.toFixed(1)}%</span>
      <span className="tabular-nums text-content-muted">
        ({nulos} de {total})
      </span>
    </span>
  );
}

interface TablaCalidadProps {
  filas: CalidadCampo[];
  onExpandir?: () => void;
  onAbrirCampo?: (campo: CalidadCampo) => void;
}

/** Calidad por campo de la tabla de ingesta. */
export default function TablaCalidad({ filas, onExpandir, onAbrirCampo }: TablaCalidadProps) {
  const columnas = [
    { key: "campo", label: "Campo" },
    { key: "nulos", label: "% de nulos" },
    { key: "ejemplo", label: "Valor de ejemplo" },
    { key: "observacion", label: "Observación" },
  ];

  const data = filas.map((c) => ({
    campo: <code className="font-mono text-[11px] text-content">{c.campo}</code>,
    nulos: <BarraNulos pct={c.pctNulos} nulos={c.nulos} total={c.total} />,
    ejemplo: <code className="font-mono text-[11px] text-content-secondary">{c.valorEjemplo}</code>,
    observacion: c.observacion ? (
      <span className="text-content-secondary">{c.observacion}</span>
    ) : (
      <span className="italic text-content-muted">Sin observaciones</span>
    ),
  }));

  return (
    <Card
      title="Calidad de los datos por campo"
      help="Porcentaje de valores nulos sobre los registros recibidos en la ventana observada."
      action={
        onExpandir ? (
          <button
            type="button"
            onClick={onExpandir}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-content-secondary transition-colors hover:bg-surface-tertiary"
          >
            <IconExpand size={13} />
            Pantalla completa
          </button>
        ) : undefined
      }
      footer="La deduplicación se hace por hash de origen; la frescura se controla con la frecuencia de ingesta (cada 15 min)."
    >
      <DataTable
        columns={columnas}
        data={data}
        onRowClick={onAbrirCampo ? (_row, i) => onAbrirCampo(filas[i]) : undefined}
        emptyMessage="Sin métricas de calidad."
      />
    </Card>
  );
}
