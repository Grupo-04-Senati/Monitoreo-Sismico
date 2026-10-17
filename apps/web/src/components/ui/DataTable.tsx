import type { ReactNode } from "react";

interface DataTableProps {
  columns: { key: string; label: string; className?: string }[];
  data: Record<string, ReactNode>[];
  emptyMessage?: string;
  onRowClick?: (row: Record<string, ReactNode>, index: number) => void;
  sort?: { key: string; dir: "asc" | "desc" } | null;
  onHeaderSort?: (key: string) => void;
}

export default function DataTable({ columns, data, emptyMessage = "Sin datos disponibles", onRowClick, sort, onHeaderSort }: DataTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-10 text-content-muted text-sm">{emptyMessage}</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left py-2 px-3 font-medium text-content-secondary text-xs uppercase tracking-wide ${col.className ?? ""}`}
                aria-sort={sort?.key === col.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
              >
                {onHeaderSort ? (
                  <button
                    type="button"
                    onClick={() => onHeaderSort(col.key)}
                    className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-content transition-colors"
                  >
                    {col.label}
                    <span className="text-[9px] text-content-muted">
                      {sort?.key === col.key ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className={`border-b border-border last:border-0 ${
                onRowClick ? "cursor-pointer hover:bg-surface-tertiary" : ""
              }`}
              onClick={onRowClick ? () => onRowClick(row, i) : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} className={`py-2.5 px-3 text-content ${col.className ?? ""}`}>
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
