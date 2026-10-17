import type { ReactNode } from "react";

interface EmptyStateProps {
  message?: string;
  description?: string;
  icon?: ReactNode;
}

export default function EmptyState({ message = "Módulo en construcción", description, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-surface-tertiary rounded-2xl flex items-center justify-center mb-4 text-content-muted">
        {icon ?? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
          </svg>
        )}
      </div>
      <p className="text-base font-medium text-content-secondary">{message}</p>
      <p className="text-sm text-content-muted mt-1">{description ?? "Esta función estará disponible próximamente."}</p>
    </div>
  );
}
