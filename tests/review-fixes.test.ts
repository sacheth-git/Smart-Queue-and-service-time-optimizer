import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { aheadAtArrival } from "@/lib/analytics/backtest";
import { forecastArrivals } from "@/lib/analytics/recommendations";
import { BottleneckAlerts } from "@/components/admin/bottleneck-alerts";
import { demoNow } from "@/lib/clock";
import { createDb } from "@/lib/db/client";
import { services } from "@/lib/db/schema";
import { resetDemo } from "@/lib/db/seed";
import { effectiveAhead } from "@/lib/estimate/wait";
import { checkIn } from "@/lib/queue/check-in";
import { callNext } from "@/lib/queue/counters";
import { transition } from "@/lib/queue/transitions";
import { staffView, tokenView } from "@/lib/queue/views";
import { decideTriage } from "@/lib/triage/decide";
import { T0, testDb } from "./helpers";

const arrive = (db: ReturnType<typeof testDb>, n: number, itemCodes: string[] = [], key = `k${n}`) =>
  checkIn(db, {
    serviceId: "general",
    phone: `90000000${String(n).padStart(2, "0")}`,
    itemCodes,
    idempotencyKey: key,
    now: T0,
  }).token;

test("a new item at the same level reopens staff review", () => {
  const db = testDb();
  const t = arrive(db, 1, ["chest_pain"]);
  decideTriage(db, { tokenId: t.id, decision: "routine", overrideReason: "Assessed in person", staffLabel: "Staff", now: T0 });
  arrive(db, 1, ["difficulty_breathing"], "again");
  expect(staffView(db, T0).pendingReview.map((p) => p.code)).toEqual([t.code]);
});

test("a called patient who adds an item reaches staff review", () => {
  const db = testDb();
  const t = arrive(db, 1);
  callNext(db, "general-1", T0);
  arrive(db, 1, ["chest_pain"], "again");
  expect(staffView(db, T0).pendingReview.map((p) => p.code)).toEqual([t.code]);
  decideTriage(db, { tokenId: t.id, decision: "urgent", staffLabel: "Staff", now: T0 });
  expect(staffView(db, T0).pendingReview).toHaveLength(0);
});

test("a final token keeps no symptom labels", () => {
  const db = testDb();
  const t = arrive(db, 1, ["chest_pain"]);
  expect(transition(db, t.id, "cancelled", { now: T0, actor: "patient" }).reasonsJson).toBeNull();
});

test("people at a counter count as half a visit", () => {
  expect(effectiveAhead(2, 2)).toBe(3);
});

test("the live estimate uses that weighting", () => {
  const db = testDb();
  arrive(db, 1);
  const second = arrive(db, 2);
  callNext(db, "general-1", T0);
  const estimate = tokenView(db, second.code, T0)!.estimate;
  expect(estimate).toMatchObject({ kind: "range", midMin: 2.5 });
});

test("the replay counts the queue the same way as the live estimate", () => {
  const visit = (arrivedAt: number, startedAt: number, completedAt: number) => ({ arrivedAt, startedAt, completedAt });
  const atCounter = visit(0, 1, 100);
  const inQueue = visit(1, 200, 300);
  const finished = visit(0, 1, 5);
  expect(aheadAtArrival([atCounter, inQueue, finished], 50)).toBe(1.5);
});

test("the forecast starts from now and waits are measured from now", () => {
  const db = createDb(":memory:");
  resetDemo(db, T0);
  const now = demoNow(db, T0);
  const lab = db.select().from(services).all().find((s) => s.id === "lab")!;
  const fullHour = forecastArrivals(db, lab, now, 12, 6);
  const lateInHour = forecastArrivals(db, lab, now + 45 * 60_000, 12, 6);
  expect(fullHour.every((a) => a.atMin >= 0)).toBe(true);
  expect(lateInHour.length).toBeLessThan(fullHour.length);
  expect(Math.max(...lateInHour.map((a) => a.atMin))).toBeLessThanOrEqual(15);
}, 15_000);

test("live bottleneck figures carry a label", () => {
  const html = renderToStaticMarkup(
    createElement(BottleneckAlerts, {
      items: [
        {
          serviceId: "lab",
          serviceName: "Lab",
          load: 3.78,
          longestWait: 59,
          cause: "too_few_counters",
          message: "Lab: too few counters are open for current demand.",
        },
      ],
    }),
  );
  expect(html).toContain("378%");
  expect(html).toContain("Estimated");
});

test("no screen uses a banned word", () => {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "ui" ? [] : walk(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    });
  const hits = ["app", "components"]
    .flatMap(walk)
    .filter((file) => /guarantee|appointment/i.test(fs.readFileSync(file, "utf8")));
  expect(hits).toEqual([]);
});
