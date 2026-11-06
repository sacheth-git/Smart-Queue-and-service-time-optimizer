import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { counters, historicalVisits, services, tokens, type Service } from "@/lib/db/schema";
import { serviceStats } from "@/lib/estimate/stats";
import { meanOf } from "@/lib/estimate/wait";
import { mulberry32, normal } from "@/lib/rng";
import { peakHours } from "./peaks";
import { simulateQueue, type Arrival } from "./simulate";

const MINUTE = 60_000;
const MIN_IMPROVEMENT = 5;

export type Recommendation = {
  serviceId: string;
  title: string;
  windowLabel: string;
  currentAvgWait: number;
  projectedAvgWait: number;
  basis: string;
};

const clockLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/** Patients already waiting, plus arrivals expected from sample data for this weekday. */
function forecastArrivals(db: Db, service: Service, now: number, endHour: number, mean: number): Arrival[] {
  const rng = mulberry32(7);
  const date = new Date(now);
  const startOfHour = date.getHours();
  const duration = () => Math.max(1.5, normal(rng, mean, 0.3 * mean));

  const waiting = db
    .select()
    .from(tokens)
    .where(and(eq(tokens.serviceId, service.id), eq(tokens.status, "waiting")))
    .all()
    .sort((a, b) => a.checkedInAt - b.checkedInAt)
    .map((t) => ({ atMin: (t.checkedInAt - now) / MINUTE, serviceMin: duration() }));

  const history = db
    .select()
    .from(historicalVisits)
    .where(and(eq(historicalVisits.serviceId, service.id), eq(historicalVisits.weekday, date.getDay())))
    .all();
  const days = new Set(history.map((v) => new Date(v.arrivedAt).toDateString())).size || 1;

  const future: Arrival[] = [];
  for (let hour = startOfHour; hour < endHour; hour++) {
    const expected = Math.round(history.filter((v) => v.hour === hour).length / days);
    const offset = (hour - startOfHour) * 60;
    for (let i = 0; i < expected; i++) {
      future.push({ atMin: offset + ((i + 0.5) / expected) * 60, serviceMin: duration() });
    }
  }
  return [...waiting, ...future];
}

function recommendFor(db: Db, service: Service, now: number): Recommendation | null {
  const list = db.select().from(counters).where(eq(counters.serviceId, service.id)).all();
  const open = list.filter((c) => c.isOpen).length;
  if (open === 0 || open >= list.length) return null;

  const startHour = new Date(now).getHours();
  const peaks = peakHours(db, service.id);
  const endHour = Math.max(startHour + 1, (peaks.at(-1) ?? startHour) + 1);
  const { mean } = serviceStats(db, service.id, now);
  const arrivals = forecastArrivals(db, service, now, endHour, mean);
  if (arrivals.length === 0) return null;

  const average = (c: number) => meanOf(simulateQueue(arrivals, c).map((v) => v.waitMin));
  const currentAvgWait = Math.round(average(open));
  const projectedAvgWait = Math.round(average(open + 1));
  if (currentAvgWait - projectedAvgWait <= MIN_IMPROVEMENT) return null;

  const windowLabel = `${clockLabel(startHour)} to ${clockLabel(endHour)}`;
  return {
    serviceId: service.id,
    title: `Open one more ${service.name} counter from ${windowLabel}`,
    windowLabel,
    currentAvgWait,
    projectedAvgWait,
    basis: "Today's arrivals plus a forecast from sample data",
  };
}

export function recommendations(db: Db, now: number): Recommendation[] {
  return db
    .select()
    .from(services)
    .all()
    .map((service) => recommendFor(db, service, now))
    .filter((r): r is Recommendation => r !== null);
}
