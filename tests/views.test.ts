import { expect, test } from "vitest";
import { callNext, closeCounter, openCounter } from "@/lib/queue/counters";
import { checkIn } from "@/lib/queue/check-in";
import { transition } from "@/lib/queue/transitions";
import { displayView, staffView, tokenView } from "@/lib/queue/views";
import { decideTriage } from "@/lib/triage/decide";
import { T0, testDb } from "./helpers";

function patient(db: ReturnType<typeof testDb>, n: number, itemCodes: string[] = [], serviceId = "general") {
  return checkIn(db, {
    serviceId,
    phone: `90000000${String(n).padStart(2, "0")}`,
    itemCodes,
    idempotencyKey: `k${n}`,
    now: T0 + n * 1000,
  }).token;
}

test("closing a busy counter is rejected and the token is unchanged", () => {
  const db = testDb();
  patient(db, 1);
  const called = callNext(db, "general-1", T0)!;
  expect(() => closeCounter(db, "general-1")).toThrow(/Finish the current patient/);
  expect(tokenView(db, called.code, T0)!.status).toBe("called");
});

test("closing the last counter gives no_counter on the token view", () => {
  const db = testDb();
  const t = patient(db, 1);
  closeCounter(db, "general-1");
  closeCounter(db, "general-2");
  expect(tokenView(db, t.code, T0)!.estimate).toEqual({ kind: "no_counter" });
});

test("reopening a counter restores a range", () => {
  const db = testDb();
  const t = patient(db, 1);
  closeCounter(db, "general-1");
  closeCounter(db, "general-2");
  openCounter(db, "general-2");
  expect(tokenView(db, t.code, T0)!.estimate).toMatchObject({ kind: "range" });
});

test("callNext takes the highest confirmed priority", () => {
  const db = testDb();
  patient(db, 1);
  const second = patient(db, 2, ["chest_pain"]);
  decideTriage(db, { tokenId: second.id, decision: "urgent", staffLabel: "Staff", now: T0 });
  expect(callNext(db, "general-1", T0)!.code).toBe(second.code);
});

test("callNext ignores an unconfirmed suggestion", () => {
  const db = testDb();
  const first = patient(db, 1);
  patient(db, 2, ["chest_pain"]);
  expect(callNext(db, "general-1", T0)!.code).toBe(first.code);
});

test("callNext returns null on an empty queue", () => {
  expect(callNext(testDb(), "general-1", T0)).toBeNull();
});

test("callNext rejects a closed counter", () => {
  const db = testDb();
  patient(db, 1);
  closeCounter(db, "general-1");
  expect(() => callNext(db, "general-1", T0)).toThrow(/closed/i);
});

test("callNext rejects a counter already holding a token", () => {
  const db = testDb();
  patient(db, 1);
  patient(db, 2);
  callNext(db, "general-1", T0);
  expect(() => callNext(db, "general-1", T0)).toThrow(/Finish the current patient/);
});

test("a confirmed urgent patient pushes the position of those behind", () => {
  const db = testDb();
  const first = patient(db, 1);
  const second = patient(db, 2, ["chest_pain"]);
  expect(tokenView(db, first.code, T0)!.position).toBe(1);
  decideTriage(db, { tokenId: second.id, decision: "urgent", staffLabel: "Staff", now: T0 });
  expect(tokenView(db, first.code, T0)!.position).toBe(2);
});

test("cancelling a patient ahead moves the next one up", () => {
  const db = testDb();
  const first = patient(db, 1);
  const second = patient(db, 2);
  transition(db, first.id, "cancelled", { now: T0, actor: "patient" });
  expect(tokenView(db, second.code, T0)!.position).toBe(1);
});

test("the check-in estimate is stored on the token", () => {
  const db = testDb();
  patient(db, 1);
  const second = patient(db, 2);
  expect(second.estMidMin).toBeCloseTo(5);
  expect(second.estHighMin).toBeGreaterThan(second.estLowMin!);
});

test("a final token has no estimate and reports isFinal", () => {
  const db = testDb();
  const t = patient(db, 1);
  transition(db, t.id, "cancelled", { now: T0, actor: "patient" });
  expect(tokenView(db, t.code, T0)).toMatchObject({ estimate: null, isFinal: true, status: "cancelled" });
});

test("an unknown code returns null", () => {
  expect(tokenView(testDb(), "GEN-999", T0)).toBeNull();
});

test("tokenView and displayView JSON contain no priority or reasons", () => {
  const db = testDb();
  const t = patient(db, 1, ["chest_pain"]);
  decideTriage(db, { tokenId: t.id, decision: "urgent", staffLabel: "Staff", now: T0 });
  callNext(db, "general-1", T0);
  patient(db, 2, ["high_fever"]);
  const leak = /priority|urgent|reason|chest|fever|phone/i;
  expect(JSON.stringify(tokenView(db, t.code, T0))).not.toMatch(leak);
  expect(JSON.stringify(displayView(db))).not.toMatch(leak);
});

test("displayView shows now serving and at most six up next", () => {
  const db = testDb();
  for (let n = 1; n <= 9; n++) patient(db, n);
  callNext(db, "general-1", T0);
  const general = displayView(db).find((s) => s.serviceId === "general")!;
  expect(general.nowServing).toEqual([{ code: "GEN-001", counterLabel: "Counter 1", staffName: null }]);
  expect(general.upNext).toHaveLength(6);
  expect(general.upNext[0]).toBe("GEN-002");
});

test("staffView lists unreviewed suggestions urgent first", () => {
  const db = testDb();
  patient(db, 1, ["high_fever"]);
  patient(db, 2, ["chest_pain"]);
  const view = staffView(db, T0);
  expect(view.pendingReview.map((p) => p.code)).toEqual(["GEN-002", "GEN-001"]);
  expect(view.pendingReview[0].reasons).toEqual(["Chest pain"]);
});

test("a reviewed suggestion leaves the pending list", () => {
  const db = testDb();
  const t = patient(db, 1, ["high_fever"]);
  decideTriage(db, { tokenId: t.id, decision: "priority", staffLabel: "Staff", now: T0 });
  expect(staffView(db, T0).pendingReview).toHaveLength(0);
});
