import type { KpiCard } from "@/types";
import Card from "./Card";

const arrowMap = { up: "↑", down: "↓", neutral: "—" } as const;

export default function KpiCard({ data }: { data: KpiCard }) {
  return (
    <Card className="min-h-[100px]">
      <p className="text-xs text-content-muted font-medium uppercase tracking-wide">{data.label}</p>
      <p className="text-2xl font-bold text-content mt-1">{data.value}</p>
      {data.change && (
        <p
          className={`text-xs mt-1 ${
            data.changeType === "up"
              ? "text-success"
              : data.changeType === "down"
                ? "text-info"
                : "text-content-muted"
          }`}
        >
          {arrowMap[data.changeType ?? "neutral"]} {data.change}
        </p>
      )}
    </Card>
  );
}
