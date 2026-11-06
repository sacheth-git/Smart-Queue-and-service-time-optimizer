import { StatLabel } from "@/components/stat-label";
import { Card, CardContent } from "@/components/ui/card";
import type { kpis } from "@/lib/analytics/kpis";

export function KpiRow({ data }: { data: ReturnType<typeof kpis> }) {
  const tiles = [
    { label: "Waiting now", value: String(data.waitingNow) },
    { label: "Average wait today", value: `${data.avgWaitToday} min` },
    { label: "Longest current wait", value: `${data.longestWait} min` },
    { label: "Patients served", value: String(data.served) },
    { label: "No-show rate", value: `${Math.round(data.noShowRate * 100)}%` },
  ];
  return (
    <section aria-label="Key numbers" className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((tile) => (
          <Card key={tile.label} size="sm">
            <CardContent>
              <p className="text-sm text-muted-foreground">{tile.label}</p>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{tile.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div>
        <StatLabel kind="measured" />
      </div>
    </section>
  );
}
