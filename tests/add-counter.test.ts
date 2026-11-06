import { afterEach, describe, expect, test } from "vitest";
import { POST } from "@/app/api/admin/counters/route";
import { addCounterSchema } from "@/lib/api/schemas";
import type { Db } from "@/lib/db/client";
import { checkIn } from "@/lib/queue/check-in";
import { addCounter, callNext } from "@/lib/queue/counters";
import { staffView } from "@/lib/queue/views";
import { T0, testDb } from "./helpers";

const generalIn = (db: ReturnType<typeof testDb>) => staffView(db, T0).services.find((s) => s.id === "general")!;

function highEstimate(db: ReturnType<typeof testDb>) {
  const { estimate } = generalIn(db);
  if (estimate.kind === "no_counter") throw new Error("Expected an open counter");
  return estimate.highMin;
}

test("a new counter takes the next number for its service, open and named", () => {
  const db = testDb();
  const counter = addCounter(db, { serviceId: "general", staffName: "Dr. Test Doctor" });
  expect(counter).toMatchObject({
    id: "general-3",
    serviceId: "general",
    label: "Counter 3",
    staffName: "Dr. Test Doctor",
    isOpen: 1,
  });
});

test("numbering is separate for each service", () => {
  const db = testDb();
  expect(addCounter(db, { serviceId: "lab", staffName: "Lab Tech" }).label).toBe("Counter 2");
});

test("adding two counters in a row gives two different counters", () => {
  const db = testDb();
  addCounter(db, { serviceId: "general", staffName: "First" });
  expect(addCounter(db, { serviceId: "general", staffName: "Second" }).id).toBe("general-4");
});

test("the staff console shows the new counter", () => {
  const db = testDb();
  addCounter(db, { serviceId: "general", staffName: "Dr. Test Doctor" });
  expect(generalIn(db).counters.map((c) => c.label)).toEqual(["Counter 1", "Counter 2", "Counter 3"]);
});

test("a new counter lowers the estimated wait", () => {
  const db = testDb();
  for (let i = 1; i <= 12; i++) {
    checkIn(db, {
      serviceId: "general",
      phone: `90000000${String(i).padStart(2, "0")}`,
      itemCodes: [],
      idempotencyKey: `k${i}`,
      now: T0,
    });
  }
  const before = highEstimate(db);
  addCounter(db, { serviceId: "general", staffName: "Dr. Test Doctor" });
  expect(highEstimate(db)).toBeLessThan(before);
});

test("a new counter can call the next waiting patient", () => {
  const db = testDb();
  const { token } = checkIn(db, {
    serviceId: "general",
    phone: "9000000001",
    itemCodes: [],
    idempotencyKey: "k1",
    now: T0,
  });
  const counter = addCounter(db, { serviceId: "general", staffName: "Dr. Test Doctor" });
  expect(callNext(db, counter.id, T0)?.id).toBe(token.id);
});

test("an unknown service is refused", () => {
  const db = testDb();
  expect(() => addCounter(db, { serviceId: "dental", staffName: "Dr. Test Doctor" })).toThrow(
    expect.objectContaining({ code: "service_not_found", status: 404 }),
  );
});

test("the name is trimmed and a blank name is rejected", () => {
  expect(addCounterSchema.parse({ serviceId: "general", staffName: "  Dr. Test  " }).staffName).toBe("Dr. Test");
  expect(addCounterSchema.safeParse({ serviceId: "general", staffName: "   " }).success).toBe(false);
});

describe("POST /api/admin/counters", () => {
  const store = globalThis as unknown as { __pulsequeueDb?: Db };
  const post = (body: unknown) =>
    POST(new Request("http://demo/api/admin/counters", { method: "POST", body: JSON.stringify(body) }));

  afterEach(() => {
    delete store.__pulsequeueDb;
  });

  test("adds the counter and returns it", async () => {
    store.__pulsequeueDb = testDb();
    const response = await post({ serviceId: "general", staffName: "  Dr. Test Doctor " });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ label: "Counter 3", staffName: "Dr. Test Doctor", isOpen: 1 });
  });

  test("refuses a blank name without adding anything", async () => {
    const db = testDb();
    store.__pulsequeueDb = db;
    const response = await post({ serviceId: "general", staffName: "  " });
    expect(response.status).toBe(400);
    expect(generalIn(db).counters).toHaveLength(2);
  });
});
