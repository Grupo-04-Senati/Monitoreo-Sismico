import { Skeleton } from "@/components/ui/Skeleton";

/** Esqueleto de la tabla mientras se cargan los eventos (evita saltos de layout). */
export default function TablaSkeleton({ filas = 8 }: { filas?: number }) {
  return (
    <div className="chart-plot overflow-hidden rounded-lg" aria-hidden="true">
      <div className="flex items-center gap-4 border-b border-border bg-surface-tertiary px-3 py-2.5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-40" />
        <span className="flex-1" />
        <Skeleton className="h-3 w-16" />
      </div>
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border px-3 py-3 last:border-0">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </div>
  );
}
