import { StatLabel } from "@/components/stat-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HeatCell } from "@/lib/analytics/peaks";

const DAYS = [
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" },
];
const HOURS = Array.from({ length: 10 }, (_, i) => 8 + i);
const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

export function PeakHeatmap({ cells }: { cells: HeatCell[] }) {
  const top = Math.max(1, ...cells.map((c) => c.avgArrivals));
  const peak = cells.reduce<HeatCell | null>((best, c) => (!best || c.avgArrivals > best.avgArrivals ? c : best), null);
  const find = (day: number, hour: number) => cells.find((c) => c.weekday === day && c.hour === hour);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Peak hours</CardTitle>
        <CardDescription>
          Average arrivals across all services.
          {peak &&
            ` Busiest: ${DAYS.find((d) => d.day === peak.weekday)?.label} ${hourLabel(peak.hour)}, about ${Math.round(peak.avgArrivals)} patients.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <div className="grid min-w-[560px] grid-cols-[3rem_repeat(10,1fr)] gap-0.5 text-xs">
            <span />
            {HOURS.map((hour) => (
              <span key={hour} className="pb-1 text-center text-muted-foreground">
                {String(hour).padStart(2, "0")}
              </span>
            ))}
            {DAYS.map(({ day, label }) => (
              <div key={day} className="contents">
                <span className="flex items-center text-muted-foreground">{label}</span>
                {HOURS.map((hour) => {
                  const cell = find(day, hour);
                  const value = cell?.avgArrivals ?? 0;
                  const share = Math.round(10 + (value / top) * 90);
                  const text = `${label} ${hourLabel(hour)}: ${value} arrivals on average`;
                  return (
                    <div key={hour} className="group relative">
                      <div
                        role="img"
                        aria-label={text}
                        className="h-8 rounded-sm transition-shadow group-hover:ring-2 group-hover:ring-foreground/40"
                        style={{ background: `color-mix(in oklch, var(--primary) ${share}%, var(--card))` }}
                      />
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-foreground px-2 py-1 whitespace-nowrap text-background group-hover:block">
                        {text}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <StatLabel kind="sample" />
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            Fewer
            <span
              className="h-2 w-24 rounded-sm"
              style={{
                background: "linear-gradient(to right, color-mix(in oklch, var(--primary) 10%, var(--card)), var(--primary))",
              }}
            />
            More
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
