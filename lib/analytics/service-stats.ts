import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { counters, services, tokens, triageDecisions } from "@/lib/db/schema";
import { serviceStats } from "@/lib/estimate/stats";
import { meanOf } from "@/lib/estimate/wait";

const MINUTE = 60_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function serviceAnalytics(db: Db, now: number) {
  return db
    .select()
    .from(services)
    .all()
    .map((service) => {
      const all = db.select().from(tokens).where(eq(tokens.serviceId, service.id)).all();
      const done = all.filter((t) => t.status === "completed");
      const started = all.filter((t) => t.startedAt !== null);
      const noShows = all.filter((t) => t.status === "no_show").length;
      const closed = all.filter((t) => t.finishedAt !== null).length;
      const open = db
        .select()
        .from(counters)
        .where(and(eq(counters.serviceId, service.id), eq(counters.isOpen, 1)))
        .all().length;
      const stats = serviceStats(db, service.id, now);
      return {
        serviceId: service.id,
        serviceName: service.name,
        served: done.length,
        waiting: all.filter((t) => t.status === "waiting").length,
        openCounters: open,
        avgService: done.length ? round1(meanOf(done.map((t) => (t.finishedAt! - t.startedAt!) / MINUTE))) : 0,
        avgWait: started.length
          ? round1(meanOf(started.map((t) => (t.startedAt! - t.checkedInAt) / MINUTE)))
          : 0,
        noShowRate: closed ? noShows / closed : 0,
        estimateInputs: {
          mean: round1(stats.mean),
          sd: round1(stats.sd),
          todayCount: stats.todayCount,
          todayWeight: Math.round(stats.todayWeight * 100),
          historicalMedian: round1(stats.historicalMedian),
        },
      };
    });
}

export function auditLog(db: Db) {
  return db
    .select()
    .from(triageDecisions)
    .all()
    .reverse()
    .slice(0, 20)
    .map((row) => ({ ...row, reasons: JSON.parse(row.reasonsJson ?? "[]") as string[] }));
}
