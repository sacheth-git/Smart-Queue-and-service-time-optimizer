import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { demoNow, setClock } from "@/lib/clock";
import type { Db } from "@/lib/db/client";
import { counters, services, tokens } from "@/lib/db/schema";
import { serviceStats } from "@/lib/estimate/stats";
import { callNext, counterToken } from "@/lib/queue/counters";
import { checkIn } from "@/lib/queue/check-in";
import { transition } from "@/lib/queue/transitions";

const MINUTE = 60_000;

/** Same token always gets the same duration, so that a demo replays the same way. */
export function serviceDuration(tokenId: string, mean: number, sd: number): number {
  let hash = 0;
  for (const ch of tokenId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return Math.max(1.5, mean + sd * ((hash % 1000) / 500 - 1) * 1.5);
}

export function simulateRush(db: Db, now: number, serviceId = "lab", patients = 15): number {
  const issued = db.select({ n: count() }).from(tokens).get()!.n;
  for (let i = 0; i < patients; i++) {
    checkIn(db, {
      serviceId,
      phone: `91${String(issued + i).padStart(8, "0")}`,
      itemCodes: [],
      idempotencyKey: randomUUID(),
      now,
    });
  }
  return patients;
}

export function advanceTime(
  db: Db,
  minutes: number,
  realNow = Date.now(),
): { completed: number; started: number } {
  const steps = Math.min(30, Math.max(1, Math.round(minutes)));
  const start = demoNow(db, realNow);
  const stats = new Map(
    db.select().from(services).all().map((s) => [s.id, serviceStats(db, s.id, start)]),
  );
  let completed = 0;
  let started = 0;

  return db.transaction(() => {
    for (let step = 1; step <= steps; step++) {
      const t = start + step * MINUTE;
      for (const token of db.select().from(tokens).where(eq(tokens.status, "serving")).all()) {
        const { mean, sd } = stats.get(token.serviceId)!;
        if (token.startedAt! + serviceDuration(token.id, mean, sd) * MINUTE <= t) {
          transition(db, token.id, "completed", { now: t, actor: "demo" });
          completed += 1;
        }
      }
      for (const token of db.select().from(tokens).where(eq(tokens.status, "called")).all()) {
        transition(db, token.id, "serving", { now: t, actor: "demo" });
        started += 1;
      }
      const open = db.select().from(counters).where(eq(counters.isOpen, 1)).all();
      for (const counter of open) {
        if (counterToken(db, counter.id)) continue;
        const next = callNext(db, counter.id, t, "demo");
        if (next) {
          transition(db, next.id, "serving", { now: t, actor: "demo" });
          started += 1;
        }
      }
    }
    setClock(db, start + steps * MINUTE, realNow);
    return { completed, started };
  });
}
