import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { counters, services, tokens, type Counter, type Token } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { sortQueue } from "./order";
import { transition } from "./transitions";

function getCounter(db: Db, counterId: string): Counter {
  const counter = db.select().from(counters).where(eq(counters.id, counterId)).get();
  if (!counter) throw new DomainError("counter_not_found", "That counter does not exist.", 404);
  return counter;
}

export function counterToken(db: Db, counterId: string): Token | undefined {
  return db
    .select()
    .from(tokens)
    .where(and(eq(tokens.counterId, counterId), inArray(tokens.status, ["called", "serving"])))
    .get();
}

function assertFree(db: Db, counterId: string): void {
  if (counterToken(db, counterId)) {
    throw new DomainError("counter_busy", "Finish the current patient first.");
  }
}

/** Sets up a new open counter for a service, numbered after the ones it already has. */
export function addCounter(db: Db, input: { serviceId: string; staffName: string }): Counter {
  return db.transaction(() => {
    const service = db.select().from(services).where(eq(services.id, input.serviceId)).get();
    if (!service) throw new DomainError("service_not_found", "That service does not exist.", 404);
    const number = db.select().from(counters).where(eq(counters.serviceId, service.id)).all().length + 1;
    return db
      .insert(counters)
      .values({
        id: `${service.id}-${number}`,
        serviceId: service.id,
        label: `Counter ${number}`,
        staffName: input.staffName,
        isOpen: 1,
      })
      .returning()
      .get();
  });
}

export function openCounter(db: Db, counterId: string): void {
  getCounter(db, counterId);
  db.update(counters).set({ isOpen: 1 }).where(eq(counters.id, counterId)).run();
}

export function closeCounter(db: Db, counterId: string): void {
  getCounter(db, counterId);
  assertFree(db, counterId);
  db.update(counters).set({ isOpen: 0 }).where(eq(counters.id, counterId)).run();
}

export function callNext(db: Db, counterId: string, now: number, actor = "staff"): Token | null {
  return db.transaction(() => {
    const counter = getCounter(db, counterId);
    if (!counter.isOpen) throw new DomainError("counter_closed", "That counter is closed.");
    assertFree(db, counterId);
    const waiting = db
      .select()
      .from(tokens)
      .where(and(eq(tokens.serviceId, counter.serviceId), eq(tokens.status, "waiting")))
      .all();
    const next = sortQueue(waiting)[0];
    if (!next) return null;
    return transition(db, next.id, "called", { now, actor, counterId });
  });
}
