import { and, eq, isNotNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { historicalVisits, services, tokens } from "@/lib/db/schema";
import { blendServiceTime, sdOf } from "./wait";

export function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type ServiceStats = {
  mean: number;
  sd: number;
  todayWeight: number;
  todayCount: number;
  historicalMedian: number;
  historicalSd: number;
};

export function serviceStats(db: Db, serviceId: string, now: number): ServiceStats {
  const hour = new Date(now).getHours();
  const history = db
    .select({ serviceMin: historicalVisits.serviceMin })
    .from(historicalVisits)
    .where(and(eq(historicalVisits.serviceId, serviceId), eq(historicalVisits.hour, hour)))
    .all()
    .map((r) => r.serviceMin);

  const fallback = db.select().from(services).where(eq(services.id, serviceId)).get()?.defaultMinutes ?? 10;
  const historicalMedian = history.length ? medianOf(history) : fallback;
  const historicalSd = history.length >= 2 ? sdOf(history) : 0.3 * fallback;

  const todayMinutes = db
    .select({ startedAt: tokens.startedAt, finishedAt: tokens.finishedAt })
    .from(tokens)
    .where(
      and(
        eq(tokens.serviceId, serviceId),
        eq(tokens.status, "completed"),
        eq(tokens.endedEarly, 0),
        isNotNull(tokens.startedAt),
      ),
    )
    .all()
    .map((t) => (t.finishedAt! - t.startedAt!) / 60_000);

  const blend = blendServiceTime({ todayMinutes, historicalMedian, historicalSd });
  return { ...blend, todayCount: todayMinutes.length, historicalMedian, historicalSd };
}
