import { expect, test } from "vitest";
import { tokenEvents, tokens } from "@/lib/db/schema";
import { checkIn } from "@/lib/queue/check-in";
import { transition } from "@/lib/queue/transitions";
import { suggestPriority } from "@/lib/triage/rules";
import { T0, testDb } from "./helpers";

const input = (over: Partial<Parameters<typeof checkIn>[1]> = {}) => ({
  serviceId: "general",
  phone: "9876543210",
  itemCodes: [] as string[],
  idempotencyKey: "k1",
  now: T0,
  ...over,
});

test("creates GEN-001 then GEN-002 and stores only hash and last 4", () => {
  const db = testDb();
  const a = checkIn(db, input());
  const b = checkIn(db, input({ phone: "9876543211", idempotencyKey: "k2" }));
  expect([a.token.code, b.token.code]).toEqual(["GEN-001", "GEN-002"]);
  expect(a.outcome).toBe("created");
  expect(a.token.phoneLast4).toBe("3210");
  expect(a.token.confirmedPriority).toBe("routine");
  expect(JSON.stringify(a.token)).not.toContain("9876543210");
});

test("same idempotency key returns the same token with no new row", () => {
  const db = testDb();
  const a = checkIn(db, input());
  const b = checkIn(db, input({ itemCodes: ["chest_pain"] }));
  expect(b.token.id).toBe(a.token.id);
  expect(b.outcome).toBe("existing");
  expect(b.token.suggestedPriority).toBeNull();
  expect(db.select().from(tokens).all()).toHaveLength(1);
});

test("same phone with a new key returns existing", () => {
  const db = testDb();
  const a = checkIn(db, input());
  const b = checkIn(db, input({ idempotencyKey: "k2" }));
  expect(b).toMatchObject({ outcome: "existing", token: { id: a.token.id } });
});

test("same phone at a different service creates a new token", () => {
  const db = testDb();
  checkIn(db, input());
  const b = checkIn(db, input({ serviceId: "lab", idempotencyKey: "k2" }));
  expect(b).toMatchObject({ outcome: "created", token: { code: "LAB-001" } });
});

test("checks in again after a final state with a new token", () => {
  const db = testDb();
  const a = checkIn(db, input());
  transition(db, a.token.id, "cancelled", { now: T0, actor: "patient" });
  const b = checkIn(db, input({ idempotencyKey: "k2" }));
  expect(b.outcome).toBe("created");
  expect(b.token.id).not.toBe(a.token.id);
});

test("repeat check-in with a new item merges it and returns updated", () => {
  const db = testDb();
  const a = checkIn(db, input());
  const b = checkIn(db, input({ idempotencyKey: "k2", itemCodes: ["chest_pain"] }));
  expect(b.outcome).toBe("updated");
  expect(b.token.id).toBe(a.token.id);
  expect(b.token.suggestedPriority).toBe("urgent");
  expect(b.token.confirmedPriority).toBe("routine");
  const types = db.select().from(tokenEvents).all().map((e) => e.type);
  expect(types).toContain("items_added");
});

test("repeat check-in with an already known item changes nothing", () => {
  const db = testDb();
  checkIn(db, input({ itemCodes: ["high_fever"] }));
  const b = checkIn(db, input({ idempotencyKey: "k2", itemCodes: ["high_fever"] }));
  expect(b.outcome).toBe("existing");
});

test("rejects a 9-digit phone", () => {
  const db = testDb();
  expect(() => checkIn(db, input({ phone: "987654321" }))).toThrow(
    expect.objectContaining({ status: 400 }),
  );
});

test("rejects an unknown service with status 400", () => {
  const db = testDb();
  expect(() => checkIn(db, input({ serviceId: "nope" }))).toThrow(
    expect.objectContaining({ status: 400 }),
  );
});

test("rejects an unknown item code with status 400", () => {
  const db = testDb();
  expect(() => checkIn(db, input({ itemCodes: ["nope"] }))).toThrow(
    expect.objectContaining({ status: 400 }),
  );
});

test("suggests urgent for chest pain and lists the reason", () => {
  expect(suggestPriority(["chest_pain"])).toEqual({ level: "urgent", reasons: ["Chest pain"] });
});

test("highest level wins and all reasons are kept", () => {
  expect(suggestPriority(["high_fever", "chest_pain"])).toEqual({
    level: "urgent",
    reasons: ["High fever", "Chest pain"],
  });
});

test("no items gives no suggestion", () => {
  expect(suggestPriority([])).toBeNull();
});
