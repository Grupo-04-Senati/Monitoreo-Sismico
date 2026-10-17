import type { ReactNode } from "react";

interface FilterBarProps {
  children: ReactNode;
  onReset?: () => void;
}

export default function FilterBar({ children, onReset }: FilterBarProps) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 mb-4">
      <div className="flex flex-wrap items-end gap-3">
        {children}
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-surface-tertiary transition-colors"
          >
            Filtrar
          </button>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="px-3 py-1.5 text-sm text-content-secondary hover:text-content transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface FilterFieldProps {
  label: string;
  children: ReactNode;
}

export function FilterField({ label, children }: FilterFieldProps) {
  return (
    <div className="flex flex-col gap-1 min-w-[160px]">
      <label className="text-xs font-medium text-content-secondary">{label}</label>
      {children}
    </div>
  );
}
