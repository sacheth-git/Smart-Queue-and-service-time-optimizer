import { beforeAll, expect, test } from "vitest";
import { backtest, liveAccuracy } from "@/lib/analytics/backtest";
import { detectBottlenecks } from "@/lib/analytics/bottlenecks";
import { kpis } from "@/lib/analytics/kpis";
import { peakHeatmap, peakHours } from "@/lib/analytics/peaks";
import { recommendations } from "@/lib/analytics/recommendations";
import { serviceAnalytics } from "@/lib/analytics/service-stats";
import { demoNow } from "@/lib/clock";
import { createDb, type Db } from "@/lib/db/client";
import { resetDemo } from "@/lib/db/seed";
import { simulateRush } from "@/lib/demo/controls";
import { checkIn } from "@/lib/queue/check-in";
import { closeCounter, openCounter } from "@/lib/queue/counters";
import { transition } from "@/lib/queue/transitions";
import { T0, testDb } from "./helpers";

const seeded = () => {
  const db = createDb(":memory:");
  resetDemo(db, T0);
  return db;
};
let shared: Db;
beforeAll(() => {
  shared = seeded();
}, 15_000);
const clock = (db: Db) => demoNow(db, T0);

test("kpis return zeros on an empty day", () => {
  expect(kpis(testDb(), T0)).toEqual({
    waitingNow: 0,
    avgWaitToday: 0,
    longestWait: 0,
    served: 0,
    noShowRate: 0,
  });
});

test("kpis count no-shows over closed tokens", () => {
  const db = testDb();
  const person = (n: number) =>
    checkIn(db, {
      serviceId: "general",
      phone: `900000000${n}`,
      itemCodes: [],
      idempotencyKey: `k${n}`,
      now: T0,
    }).token.id;
  const a = person(1);
  const b = person(2);
  const c = person(3);
  const ctx = { now: T0 + 60_000, actor: "staff", counterId: "general-1" };
  transition(db, a, "called", ctx);
  transition(db, a, "no_show", ctx);
  transition(db, b, "called", ctx);
  transition(db, b, "serving", { now: T0 + 120_000, actor: "staff" });
  transition(db, b, "completed", { now: T0 + 180_000, actor: "staff" });
  const result = kpis(db, T0 + 600_000);
  expect(result.noShowRate).toBe(0.5);
  expect(result.served).toBe(1);
  expect(result.waitingNow).toBe(1);
  expect(result.avgWaitToday).toBe(2);
  expect(result.longestWait).toBe(10);
  expect(c).toBeTruthy();
});

test("heatmap has no Sunday rows and peaks in the morning", () => {
  const cells = peakHeatmap(shared);
  expect(cells.some((c) => c.weekday === 0)).toBe(false);
  const top = [...cells].sort((a, b) => b.avgArrivals - a.avgArrivals)[0];
  expect(top.hour).toBeGreaterThanOrEqual(9);
  expect(top.hour).toBeLessThanOrEqual(12);
});

test("peak hours for Lab fall in the morning", () => {
  const hours = peakHours(shared, "lab");
  expect(hours.length).toBeGreaterThan(0);
  expect(Math.min(...hours)).toBeGreaterThanOrEqual(8);
  expect(Math.max(...hours)).toBeLessThanOrEqual(13);
});

test("a rush flags Lab with cause too_few_counters when counters are closed", () => {
  const db = seeded();
  simulateRush(db, clock(db));
  const lab = detectBottlenecks(db, clock(db)).find((b) => b.serviceId === "lab")!;
  expect(lab.cause).toBe("too_few_counters");
  expect(lab.load).toBeGreaterThanOrEqual(1);
  expect(lab.message).toContain("Lab");
}, 15_000);

test("a rush with all counters open reports arrival_surge", () => {
  const db = seeded();
  openCounter(db, "lab-2");
  openCounter(db, "lab-3");
  simulateRush(db, clock(db));
  simulateRush(db, clock(db));
  const lab = detectBottlenecks(db, clock(db)).find((b) => b.serviceId === "lab")!;
  expect(lab.cause).toBe("arrival_surge");
}, 15_000);

test("no open counter with patients waiting flags without Infinity", () => {
  const db = testDb();
  checkIn(db, { serviceId: "lab", phone: "9000000001", itemCodes: [], idempotencyKey: "k", now: T0 });
  closeCounter(db, "lab-1");
  const [lab] = detectBottlenecks(db, T0);
  expect(lab).toMatchObject({ serviceId: "lab", load: null, cause: "too_few_counters" });
  expect(JSON.stringify(lab)).not.toContain("Infinity");
});

test("a quiet service is not flagged", () => {
  expect(detectBottlenecks(testDb(), T0)).toEqual([]);
});

test("Lab gets a labelled recommendation that lowers the average wait", () => {
  const rec = recommendations(shared, clock(shared)).find((r) => r.serviceId === "lab")!;
  expect(rec.title).toMatch(/^Open one more Lab counter from \d\d:00 to \d\d:00$/);
  expect(rec.projectedAvgWait).toBeLessThan(rec.currentAvgWait - 5);
  expect(rec.basis).toBe("Today's arrivals plus a forecast from sample data");
});

test("no recommendation when every counter is already open", () => {
  const db = seeded();
  openCounter(db, "lab-2");
  openCounter(db, "lab-3");
  expect(recommendations(db, clock(db)).some((r) => r.serviceId === "lab")).toBe(false);
}, 15_000);

test("recommendations are stable between polls", () => {
  const now = clock(shared);
  expect(recommendations(shared, now)).toEqual(recommendations(shared, now));
});

test("the model beats the naive baseline on sample data", () => {
  const result = backtest(shared);
  expect(result.samples).toBeGreaterThan(500);
  expect(result.modelMae).toBeLessThan(result.baselineMae);
});

test("liveAccuracy is null with no completed tokens", () => {
  expect(liveAccuracy(testDb())).toBeNull();
});

test("liveAccuracy reports seeded completions", () => {
  const result = liveAccuracy(shared)!;
  expect(result.samples).toBeGreaterThan(30);
  expect(result.mae).toBeGreaterThanOrEqual(0);
});

test("service analytics cover all four services", () => {
  const rows = serviceAnalytics(shared, clock(shared));
  expect(rows.map((r) => r.serviceId).sort()).toEqual(["general", "lab", "pediatrics", "pharmacy"]);
  const lab = rows.find((r) => r.serviceId === "lab")!;
  expect(lab.served).toBeGreaterThan(0);
  expect(lab.avgWait).toBeGreaterThan(lab.avgService);
});
