import Card from "@/components/ui/Card";
import HBarChart from "@/components/charts/HBarChart";
import type { ChartDatum } from "@/components/charts/BarChart";
import type { Role } from "@/types/auth";
import type { ConteoRol } from "../types";
import { ROLE_LABELS } from "@/types/auth";

interface GraficoUsuariosPorRolProps {
  conteos: ConteoRol[];
  onRol: (rol: Role) => void;
  onMatriz: () => void;
}

/** Distribución de usuarios por rol; cada barra abre la lista de ese rol. */
export default function GraficoUsuariosPorRol({ conteos, onRol, onMatriz }: GraficoUsuariosPorRolProps) {
  const data: ChartDatum[] = conteos.map((c) => ({
    key: c.rol,
    label: ROLE_LABELS[c.rol],
    value: c.total,
    tip: [`Rol: ${c.nombre}`, `${c.total} usuario(s)`],
  }));

  return (
    <Card
      title="Usuarios por rol"
      help="Haz clic en una barra para ver los usuarios de ese rol."
      action={
        <button
          type="button"
          onClick={onMatriz}
          className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-content-secondary transition-colors hover:bg-surface-tertiary"
        >
          Ver matriz de permisos
        </button>
      }
    >
      <HBarChart
        data={data}
        height={200}
        ariaLabel="Distribución de usuarios por rol"
        labelWidth="w-40"
        onBarClick={(d) => d.key && onRol(d.key as Role)}
      />
    </Card>
  );
}
