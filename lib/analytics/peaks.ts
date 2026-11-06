import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { historicalVisits } from "@/lib/db/schema";

export type HeatCell = { weekday: number; hour: number; avgArrivals: number };

const dayKey = (ms: number) => new Date(ms).toDateString();

export function averageArrivals(rows: { weekday: number; hour: number; arrivedAt: number }[]): HeatCell[] {
  const days = new Map<number, Set<string>>();
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!days.has(row.weekday)) days.set(row.weekday, new Set());
    days.get(row.weekday)!.add(dayKey(row.arrivedAt));
    const key = `${row.weekday}:${row.hour}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, count]) => {
    const [weekday, hour] = key.split(":").map(Number);
    return { weekday, hour, avgArrivals: Math.round((count / days.get(weekday)!.size) * 10) / 10 };
  });
}

export function peakHeatmap(db: Db): HeatCell[] {
  const rows = db
    .select({
      weekday: historicalVisits.weekday,
      hour: historicalVisits.hour,
      arrivedAt: historicalVisits.arrivedAt,
    })
    .from(historicalVisits)
    .all();
  return averageArrivals(rows);
}

/** Hours within 80% of the busiest hour for this service, averaged over all weekdays. */
export function peakHours(db: Db, serviceId: string): number[] {
  const rows = db.select().from(historicalVisits).where(eq(historicalVisits.serviceId, serviceId)).all();
  const byHour = new Map<number, number>();
  for (const row of rows) byHour.set(row.hour, (byHour.get(row.hour) ?? 0) + 1);
  const top = Math.max(0, ...byHour.values());
  return [...byHour]
    .filter(([, count]) => count >= 0.8 * top)
    .map(([hour]) => hour)
    .sort((a, b) => a - b);
}
