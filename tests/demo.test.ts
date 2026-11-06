import { and, eq, inArray, sql } from "drizzle-orm";
import { beforeAll, expect, test } from "vitest";
import { simulateQueue } from "@/lib/analytics/simulate";
import { demoNow } from "@/lib/clock";
import { createDb, type Db } from "@/lib/db/client";
import { historicalVisits, tokenEvents, tokens } from "@/lib/db/schema";
import { resetDemo } from "@/lib/db/seed";
import { advanceTime, simulateRush } from "@/lib/demo/controls";
import { staffView } from "@/lib/queue/views";
import { ACTIVE_STATUSES } from "@/lib/types";
import { T0 } from "./helpers";

const fresh = () => {
  const db = createDb(":memory:");
  resetDemo(db, T0);
  return db;
};
const active = (db: Db) =>
  db.select().from(tokens).where(inArray(tokens.status, [...ACTIVE_STATUSES])).all();

let shared: Db;
beforeAll(() => {
  shared = fresh();
}, 15_000);

test("one counter queues people in order", () => {
  const r = simulateQueue(
    [
      { atMin: 0, serviceMin: 10 },
      { atMin: 1, serviceMin: 10 },
    ],
    1,
  );
  expect(r.map((x) => x.waitMin)).toEqual([0, 9]);
  expect(r[1].startMin).toBe(10);
});

test("two counters take two people at once", () => {
  const r = simulateQueue(
    [
      { atMin: 0, serviceMin: 10 },
      { atMin: 0, serviceMin: 10 },
      { atMin: 0, serviceMin: 10 },
    ],
    2,
  );
  expect(r.map((x) => x.waitMin)).toEqual([0, 0, 10]);
});

test("an empty arrival list returns an empty result", () => {
  expect(simulateQueue([], 2)).toEqual([]);
});

test("reset finishes within 5 seconds", () => {
  const db = createDb(":memory:");
  const start = performance.now();
  resetDemo(db, T0);
  expect(performance.now() - start).toBeLessThan(5000);
}, 15_000);

test("reset is deterministic", () => {
  const codes = (db: Db) =>
    db.select().from(tokens).all().map((t) => `${t.code}:${t.status}`).sort();
  expect(codes(fresh())).toEqual(codes(shared));
}, 15_000);

test("reset leaves finished tokens, a live queue and pending reviews", () => {
  const all = shared.select().from(tokens).all();
  expect(all.filter((t) => t.status === "completed").length).toBeGreaterThanOrEqual(50);
  expect(all.some((t) => t.status === "no_show")).toBe(true);
  expect(all.some((t) => t.status === "cancelled")).toBe(true);
  expect(active(shared).length).toBeGreaterThanOrEqual(18);
  expect(staffView(shared, demoNow(shared, T0)).pendingReview).toHaveLength(2);
});

test("the clock starts at 11:00 on a weekday", () => {
  const d = new Date(demoNow(shared, T0));
  expect([d.getHours(), d.getMinutes()]).toEqual([11, 0]);
  expect([0, 6]).not.toContain(d.getDay());
});

test("Saturday demo clock rolls back to Friday", () => {
  const saturday = new Date(2026, 10, 7, 15, 0).getTime();
  const db = createDb(":memory:");
  resetDemo(db, saturday);
  expect(new Date(demoNow(db, saturday)).getDay()).toBe(5);
}, 15_000);

test("history covers Lab at 10:00 and has no Sunday rows", () => {
  const lab = shared
    .select({ n: sql<number>`count(*)` })
    .from(historicalVisits)
    .where(and(eq(historicalVisits.serviceId, "lab"), eq(historicalVisits.hour, 10)))
    .get()!.n;
  expect(lab).toBeGreaterThan(100);
  const sundays = shared
    .select({ n: sql<number>`count(*)` })
    .from(historicalVisits)
    .where(eq(historicalVisits.weekday, 0))
    .get()!.n;
  expect(sundays).toBe(0);
});

test("every seeded status change has an event row", () => {
  const finished = shared.select().from(tokens).where(eq(tokens.status, "completed")).all();
  const moves = shared.select().from(tokenEvents).where(eq(tokenEvents.toStatus, "completed")).all();
  expect(moves).toHaveLength(finished.length);
});

test("no two active tokens hold the same counter", () => {
  const held = active(shared).filter((t) => t.counterId).map((t) => t.counterId);
  expect(new Set(held).size).toBe(held.length);
});

test("rush adds 15 waiting Lab tokens", () => {
  const db = fresh();
  const before = active(db).length;
  expect(simulateRush(db, demoNow(db, T0))).toBe(15);
  const added = active(db).slice(before);
  expect(active(db).length).toBe(before + 15);
  expect(added.every((t) => t.serviceId === "lab" && t.status === "waiting")).toBe(true);
}, 15_000);

test("two rushes in a row both add tokens", () => {
  const db = fresh();
  const now = demoNow(db, T0);
  expect(simulateRush(db, now) + simulateRush(db, now)).toBe(30);
}, 15_000);

test("advance by 15 completes tokens, fills free counters and adds no arrivals", () => {
  const db = fresh();
  const total = db.select().from(tokens).all().length;
  const start = demoNow(db, T0);
  const result = advanceTime(db, 15, T0);
  expect(result.completed).toBeGreaterThan(0);
  expect(result.started).toBeGreaterThan(0);
  expect(db.select().from(tokens).all()).toHaveLength(total);
  expect(demoNow(db, T0)).toBe(start + 15 * 60_000);
}, 15_000);

test("advance clamps 500 to 30 minutes", () => {
  const db = fresh();
  const start = demoNow(db, T0);
  advanceTime(db, 500, T0);
  expect(demoNow(db, T0)).toBe(start + 30 * 60_000);
}, 15_000);

test("advance never uses a closed counter", () => {
  const db = fresh();
  simulateRush(db, demoNow(db, T0));
  advanceTime(db, 30, T0);
  const held = active(db).filter((t) => t.counterId === "lab-2" || t.counterId === "lab-3");
  expect(held).toHaveLength(0);
  expect(active(db).some((t) => t.counterId === "lab-1")).toBe(true);
}, 15_000);
