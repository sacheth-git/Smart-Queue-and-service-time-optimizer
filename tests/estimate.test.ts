import { expect, test } from "vitest";
import { historicalVisits } from "@/lib/db/schema";
import { serviceStats } from "@/lib/estimate/stats";
import { blendServiceTime, estimateWait } from "@/lib/estimate/wait";
import { T0, testDb } from "./helpers";

test("n=4 mean=10 sd=3 c=2 gives 15 to 25", () => {
  expect(estimateWait({ ahead: 4, openCounters: 2, mean: 10, sd: 3 })).toEqual({
    kind: "range",
    lowMin: 15,
    highMin: 25,
    midMin: 20,
  });
});

test("nobody ahead gives 0 to 5", () => {
  expect(estimateWait({ ahead: 0, openCounters: 2, mean: 10, sd: 3 })).toEqual({
    kind: "range",
    lowMin: 0,
    highMin: 5,
    midMin: 0,
  });
});

test("zero spread still gives a 5 minute range", () => {
  expect(estimateWait({ ahead: 9, openCounters: 1, mean: 10, sd: 0 })).toMatchObject({
    lowMin: 90,
    highMin: 95,
  });
});

test("low end never goes below zero", () => {
  expect(estimateWait({ ahead: 1, openCounters: 1, mean: 2, sd: 10 })).toMatchObject({ lowMin: 0 });
});

test("no open counter returns no_counter", () => {
  expect(estimateWait({ ahead: 3, openCounters: 0, mean: 10, sd: 3 })).toEqual({ kind: "no_counter" });
});

test("blend uses history alone with no completions today", () => {
  expect(blendServiceTime({ todayMinutes: [], historicalMedian: 10, historicalSd: 2 })).toEqual({
    mean: 10,
    sd: 2,
    todayWeight: 0,
  });
});

test("blend weights today at 0.5 after 5 completions", () => {
  const b = blendServiceTime({ todayMinutes: [20, 20, 20, 20, 20], historicalMedian: 10, historicalSd: 2 });
  expect(b.todayWeight).toBe(0.5);
  expect(b.mean).toBe(15);
  expect(b.sd).toBe(1);
});

test("blend keeps historical spread with a single completion", () => {
  const b = blendServiceTime({ todayMinutes: [20], historicalMedian: 10, historicalSd: 2 });
  expect(b.sd).toBe(2);
});

test("no history falls back to the default service time", () => {
  const db = testDb();
  expect(serviceStats(db, "general", T0)).toMatchObject({ mean: 10, sd: 3, todayCount: 0 });
});

test("history for the same hour sets the median", () => {
  const db = testDb();
  const hour = new Date(T0).getHours();
  db.insert(historicalVisits)
    .values(
      [4, 8, 30].map((serviceMin) => ({
        serviceId: "general",
        arrivedAt: T0,
        startedAt: T0,
        completedAt: T0,
        weekday: 2,
        hour,
        waitMin: 0,
        serviceMin,
        countersOpen: 1,
      })),
    )
    .run();
  expect(serviceStats(db, "general", T0).historicalMedian).toBe(8);
});
