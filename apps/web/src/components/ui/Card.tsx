import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  help?: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function Card({ title, help, action, footer, children, className = "" }: CardProps) {
  return (
    <div className={`auth-surface tilt bg-surface border border-border rounded-lg shadow-sm flex flex-col ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            {title && <h3 className="font-semibold text-sm text-content">{title}</h3>}
            {help && <span className="text-xs text-content-muted cursor-help" title={help}>ⓘ</span>}
          </div>
          {action}
        </div>
      )}
      <div className="p-4 flex-1">{children}</div>
      {footer && (
        <div className="px-4 py-2 border-t border-border text-xs font-medium text-content-secondary bg-surface-secondary rounded-b-lg">
          {footer}
        </div>
      )}
    </div>
  );
}
