interface StatusBadgeProps {
  status: string;
  label: string;
  colorClass: string;
}

export default function StatusBadge({ status, label, colorClass }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
      data-status={status}
    >
      {label}
    </span>
  );
}
