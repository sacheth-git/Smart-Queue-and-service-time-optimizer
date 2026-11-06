import { and, eq, gte } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { counters, historicalVisits, services, tokens, type Service } from "@/lib/db/schema";
import { serviceStats } from "@/lib/estimate/stats";

const MINUTE = 60_000;
const LONGEST_WAIT_LIMIT = 75;

export type BottleneckCause = "too_few_counters" | "slow_service" | "arrival_surge";

export type Bottleneck = {
  serviceId: string;
  serviceName: string;
  load: number | null;
  longestWait: number;
  cause: BottleneckCause;
  message: string;
};

const MESSAGES: Record<BottleneckCause, string> = {
  too_few_counters: "too few counters are open for current demand",
  slow_service: "each visit is taking longer than usual",
  arrival_surge: "more patients are arriving than usual for this hour",
};

function historicalHourlyRate(db: Db, serviceId: string, now: number): number {
  const hour = new Date(now).getHours();
  const rows = db
    .select({ arrivedAt: historicalVisits.arrivedAt })
    .from(historicalVisits)
    .where(and(eq(historicalVisits.serviceId, serviceId), eq(historicalVisits.hour, hour)))
    .all();
  const days = new Set(rows.map((r) => new Date(r.arrivedAt).toDateString())).size;
  return days ? rows.length / days : 0;
}

function assess(db: Db, service: Service, now: number): Bottleneck | null {
  const list = db.select().from(counters).where(eq(counters.serviceId, service.id)).all();
  const open = list.filter((c) => c.isOpen).length;
  const waiting = db
    .select()
    .from(tokens)
    .where(and(eq(tokens.serviceId, service.id), eq(tokens.status, "waiting")))
    .all();
  const longestWait = Math.round(Math.max(0, ...waiting.map((t) => (now - t.checkedInAt) / MINUTE)));
  const stats = serviceStats(db, service.id, now);
  const arrivalRate =
    db
      .select()
      .from(tokens)
      .where(and(eq(tokens.serviceId, service.id), gte(tokens.checkedInAt, now - 30 * MINUTE)))
      .all().length * 2;

  const noCounter = open === 0 && waiting.length > 0;
  const load = open ? arrivalRate / ((open * 60) / stats.mean) : null;
  const overloaded = (load ?? 0) >= 1 || longestWait >= LONGEST_WAIT_LIMIT;
  if (!noCounter && !overloaded) return null;

  let cause: BottleneckCause = "too_few_counters";
  if (!noCounter && open === list.length) {
    if (stats.mean > 1.25 * stats.historicalMedian) cause = "slow_service";
    else if (arrivalRate > 1.5 * historicalHourlyRate(db, service.id, now)) cause = "arrival_surge";
  }
  return {
    serviceId: service.id,
    serviceName: service.name,
    load: load === null ? null : Math.round(load * 100) / 100,
    longestWait,
    cause,
    message: `${service.name}: ${MESSAGES[cause]}.`,
  };
}

export function detectBottlenecks(db: Db, now: number): Bottleneck[] {
  return db
    .select()
    .from(services)
    .all()
    .map((service) => assess(db, service, now))
    .filter((b): b is Bottleneck => b !== null);
}
