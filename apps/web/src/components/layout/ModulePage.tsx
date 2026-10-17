import type { ReactNode } from "react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

interface ModulePageProps {
  title: string;
  actions?: ReactNode;
  filters?: ReactNode;
  children?: ReactNode;
}

export default function ModulePage({ title, actions, filters, children }: ModulePageProps) {
  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <h1 className="text-xl font-bold text-content">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {filters && <div className="mb-4">{filters}</div>}

      <Card>
        {children ?? <EmptyState />}
      </Card>
    </div>
  );
}
