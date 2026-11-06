import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { counters } from "@/lib/db/schema";
import { createDb } from "@/lib/db/client";
import { resetDemo } from "@/lib/db/seed";
import { checkIn } from "@/lib/queue/check-in";
import { callNext } from "@/lib/queue/counters";
import { displayView, staffView, tokenView } from "@/lib/queue/views";
import { T0, testDb } from "./helpers";

function withDoctor() {
  const db = testDb();
  db.update(counters).set({ staffName: "Dr. Meera Rao" }).where(eq(counters.id, "general-1")).run();
  const token = checkIn(db, {
    serviceId: "general",
    phone: "9000000001",
    itemCodes: [],
    idempotencyKey: "k1",
    now: T0,
  }).token;
  callNext(db, "general-1", T0);
  return { db, token };
}

test("the patient's token page names the staff member at the counter", () => {
  const { db, token } = withDoctor();
  expect(tokenView(db, token.code, T0)).toMatchObject({ counterLabel: "Counter 1", staffName: "Dr. Meera Rao" });
});

test("a waiting patient has no staff name yet", () => {
  const db = testDb();
  const token = checkIn(db, {
    serviceId: "general",
    phone: "9000000001",
    itemCodes: [],
    idempotencyKey: "k1",
    now: T0,
  }).token;
  expect(tokenView(db, token.code, T0)).toMatchObject({ counterLabel: null, staffName: null });
});

test("the waiting-room board shows the staff name beside the token", () => {
  const { db } = withDoctor();
  const general = displayView(db).find((s) => s.serviceId === "general")!;
  expect(general.nowServing).toEqual([{ code: "GEN-001", counterLabel: "Counter 1", staffName: "Dr. Meera Rao" }]);
});

test("the staff console lists each counter's staff member", () => {
  const { db } = withDoctor();
  const general = staffView(db, T0).services.find((s) => s.id === "general")!;
  expect(general.counters.map((c) => c.staffName)).toEqual(["Dr. Meera Rao", null]);
});

test("adding a staff name leaks no triage data to patient or public views", () => {
  const { db, token } = withDoctor();
  const leak = /priority|urgent|reason|chest|fever|phone/i;
  expect(JSON.stringify(tokenView(db, token.code, T0))).not.toMatch(leak);
  expect(JSON.stringify(displayView(db))).not.toMatch(leak);
});

test("every seeded counter has a distinct staff name", () => {
  const db = createDb(":memory:");
  resetDemo(db, T0);
  const names = db.select().from(counters).all().map((c) => c.staffName);
  expect(names.every((n) => typeof n === "string" && n.length > 0)).toBe(true);
  expect(new Set(names).size).toBe(names.length);
}, 15_000);

test("no seeded staff name looks like patient data", () => {
  const db = createDb(":memory:");
  resetDemo(db, T0);
  const names = db.select().from(counters).all().map((c) => c.staffName);
  expect(names.join(" ")).not.toMatch(/\d/);
}, 15_000);
