import { and, eq, gte, isNotNull, lt } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { historicalVisits, services, tokens } from "@/lib/db/schema";
import { medianOf } from "@/lib/estimate/stats";
import { blendServiceTime, meanOf, sdOf } from "@/lib/estimate/wait";

const DAY = 86_400_000;
const MINUTE = 60_000;

/**
 * Replays the last 7 sample days using only what was known at each arrival:
 * older days for the historical median, and earlier completions that same day.
 */
export function backtest(db: Db): { modelMae: number; baselineMae: number; samples: number } {
  const latest = db.select().from(historicalVisits).all().reduce((max, v) => Math.max(max, v.arrivedAt), 0);
  const cutoff = latest - 7 * DAY;
  const modelErrors: number[] = [];
  const baselineErrors: number[] = [];

  for (const service of db.select().from(services).all()) {
    const older = db
      .select()
      .from(historicalVisits)
      .where(and(eq(historicalVisits.serviceId, service.id), lt(historicalVisits.arrivedAt, cutoff)))
      .all();
    const recent = db
      .select()
      .from(historicalVisits)
      .where(and(eq(historicalVisits.serviceId, service.id), gte(historicalVisits.arrivedAt, cutoff)))
      .all();

    const byDay = new Map<string, typeof recent>();
    for (const visit of recent) {
      const key = new Date(visit.arrivedAt).toDateString();
      byDay.set(key, [...(byDay.get(key) ?? []), visit]);
    }

    const hourly = new Map<number, { median: number; sd: number }>();
    for (const hour of new Set(recent.map((v) => v.hour))) {
      const minutes = older.filter((v) => v.hour === hour).map((v) => v.serviceMin);
      hourly.set(hour, {
        median: minutes.length ? medianOf(minutes) : service.defaultMinutes,
        sd: minutes.length >= 2 ? sdOf(minutes) : 0.3 * service.defaultMinutes,
      });
    }

    for (const visits of byDay.values()) {
      visits.sort((a, b) => a.arrivedAt - b.arrivedAt);
      visits.forEach((visit, index) => {
        const earlier = visits.slice(0, index);
        const ahead = earlier.filter((v) => v.startedAt > visit.arrivedAt).length;
        const today = earlier.filter((v) => v.completedAt <= visit.arrivedAt).map((v) => v.serviceMin);
        const { median, sd } = hourly.get(visit.hour)!;
        const { mean } = blendServiceTime({
          todayMinutes: today.slice(-20),
          historicalMedian: median,
          historicalSd: sd,
        });
        modelErrors.push(Math.abs((ahead * mean) / visit.countersOpen - visit.waitMin));
        baselineErrors.push(Math.abs((ahead * service.defaultMinutes) / visit.countersOpen - visit.waitMin));
      });
    }
  }

  return {
    modelMae: Math.round(meanOf(modelErrors) * 10) / 10,
    baselineMae: Math.round(meanOf(baselineErrors) * 10) / 10,
    samples: modelErrors.length,
  };
}

/** Compares the estimate stored at check-in with the actual wait in this session. */
export function liveAccuracy(db: Db): { mae: number; samples: number } | null {
  const rows = db
    .select()
    .from(tokens)
    .where(and(isNotNull(tokens.startedAt), isNotNull(tokens.estMidMin)))
    .all();
  if (rows.length === 0) return null;
  const errors = rows.map((t) => Math.abs((t.startedAt! - t.checkedInAt) / MINUTE - t.estMidMin!));
  return { mae: Math.round(meanOf(errors) * 10) / 10, samples: rows.length };
}
