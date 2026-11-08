import { expect, test } from "vitest";
import { callNext, closeCounter } from "@/lib/queue/counters";
import { checkIn } from "@/lib/queue/check-in";
import { homeView, staffView, tokenView } from "@/lib/queue/views";
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

const general = (db: ReturnType<typeof testDb>) => homeView(db, T0).find((s) => s.serviceId === "general")!;

test("the home page shows who is at each counter", () => {
  const db = testDb();
  patient(db, 1);
  callNext(db, "general-1", T0);
  expect(general(db).nowServing).toEqual([{ code: "GEN-001", counterLabel: "Counter 1", staffName: null }]);
});

test("the waiting count covers everyone, while the list stops at five", () => {
  const db = testDb();
  for (let n = 1; n <= 8; n++) patient(db, n);
  expect(general(db).waiting).toBe(8);
  expect(general(db).upNext.map((t) => t.code)).toEqual(["GEN-001", "GEN-002", "GEN-003", "GEN-004", "GEN-005"]);
});

test("each waiting token shows the same estimate as its own token page", () => {
  const db = testDb();
  for (let n = 1; n <= 4; n++) patient(db, n);
  callNext(db, "general-1", T0);
  for (const row of general(db).upNext) {
    expect(row.estimate).toEqual(tokenView(db, row.code, T0)!.estimate);
  }
});

test("the wait for someone joining now matches the staff console", () => {
  const db = testDb();
  for (let n = 1; n <= 5; n++) patient(db, n);
  callNext(db, "general-1", T0);
  expect(general(db).joinNowEstimate).toEqual(staffView(db, T0).services.find((s) => s.id === "general")!.estimate);
});

test("open counters are counted, and no open counter means no estimate", () => {
  const db = testDb();
  patient(db, 1);
  expect(general(db).openCounters).toBe(2);
  closeCounter(db, "general-1");
  closeCounter(db, "general-2");
  expect(general(db).openCounters).toBe(0);
  expect(general(db).joinNowEstimate).toEqual({ kind: "no_counter" });
});

test("the home page never shows priority, reasons or phone details", () => {
  const db = testDb();
  const t = patient(db, 1, ["chest_pain"]);
  decideTriage(db, { tokenId: t.id, decision: "urgent", staffLabel: "Staff", now: T0 });
  patient(db, 2, ["high_fever"]);
  callNext(db, "general-1", T0);
  expect(JSON.stringify(homeView(db, T0))).not.toMatch(/priority|urgent|reason|chest|fever|phone|9000/i);
});
