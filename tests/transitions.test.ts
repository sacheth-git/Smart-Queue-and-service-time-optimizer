import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { tokenEvents, tokens } from "@/lib/db/schema";
import { checkIn } from "@/lib/queue/check-in";
import { transition } from "@/lib/queue/transitions";
import type { TokenStatus } from "@/lib/types";
import { insertRawToken, T0, testDb } from "./helpers";

const ctx = { now: T0, actor: "staff", counterId: "general-1" };
const read = (db: ReturnType<typeof testDb>, id: string) =>
  db.select().from(tokens).where(eq(tokens.id, id)).get()!;

describe("legal moves", () => {
  test.each<[TokenStatus, TokenStatus]>([
    ["waiting", "called"],
    ["waiting", "cancelled"],
    ["called", "serving"],
    ["called", "cancelled"],
    ["called", "no_show"],
    ["called", "waiting"],
    ["serving", "completed"],
  ])("allows %s to %s", (from, to) => {
    const db = testDb();
    const id = insertRawToken(db, { code: "GEN-001", status: from });
    expect(transition(db, id, to, ctx).status).toBe(to);
  });
});

describe("illegal moves", () => {
  test.each<[TokenStatus, TokenStatus]>([
    ["waiting", "serving"],
    ["waiting", "completed"],
    ["serving", "cancelled"],
    ["serving", "waiting"],
    ["completed", "waiting"],
    ["cancelled", "called"],
    ["no_show", "waiting"],
  ])("rejects %s to %s and leaves the token unchanged", (from, to) => {
    const db = testDb();
    const id = insertRawToken(db, { code: "GEN-001", status: from });
    expect(() => transition(db, id, to, ctx)).toThrow(/Cannot move/);
    expect(read(db, id).status).toBe(from);
    expect(db.select().from(tokenEvents).all()).toHaveLength(0);
  });
});

test("calling a token requires a counter", () => {
  const db = testDb();
  const id = insertRawToken(db, { code: "GEN-001", status: "waiting" });
  expect(() => transition(db, id, "called", { now: T0, actor: "staff" })).toThrow(/counter/i);
});

test("an unknown token is rejected with status 404", () => {
  const db = testDb();
  expect(() => transition(db, "nope", "cancelled", ctx)).toThrow(
    expect.objectContaining({ status: 404 }),
  );
});

test("final state clears phone hash and item codes and writes an event", () => {
  const db = testDb();
  const { token } = checkIn(db, {
    serviceId: "general",
    phone: "9876543210",
    itemCodes: ["high_fever"],
    idempotencyKey: "k1",
    now: T0,
  });
  const done = transition(db, token.id, "cancelled", { now: T0 + 1, actor: "patient" });
  expect(done.phoneHash).toBeNull();
  expect(done.itemCodesJson).toBeNull();
  expect(done.finishedAt).toBe(T0 + 1);
  const ev = db.select().from(tokenEvents).where(eq(tokenEvents.tokenId, token.id)).all();
  expect(ev.at(-1)).toMatchObject({
    type: "status",
    fromStatus: "waiting",
    toStatus: "cancelled",
    actor: "patient",
  });
});

test("recall clears the counter and called time", () => {
  const db = testDb();
  const id = insertRawToken(db, { code: "GEN-001", status: "waiting" });
  transition(db, id, "called", ctx);
  const back = transition(db, id, "waiting", { now: T0 + 1, actor: "staff" });
  expect(back.counterId).toBeNull();
  expect(back.calledAt).toBeNull();
});

test("serving records start time and completion can flag ended early", () => {
  const db = testDb();
  const id = insertRawToken(db, { code: "GEN-001", status: "waiting" });
  transition(db, id, "called", ctx);
  expect(transition(db, id, "serving", { now: T0 + 5, actor: "staff" }).startedAt).toBe(T0 + 5);
  const done = transition(db, id, "completed", { now: T0 + 9, actor: "staff", endedEarly: true });
  expect(done.endedEarly).toBe(1);
  expect(done.counterId).toBeNull();
});
