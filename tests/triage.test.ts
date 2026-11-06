import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { tokens, triageDecisions } from "@/lib/db/schema";
import { checkIn } from "@/lib/queue/check-in";
import { sortQueue } from "@/lib/queue/order";
import { transition } from "@/lib/queue/transitions";
import { decideTriage } from "@/lib/triage/decide";
import { T0, testDb } from "./helpers";

function setup(itemCodes: string[]) {
  const db = testDb();
  const first = checkIn(db, {
    serviceId: "general",
    phone: "9000000001",
    itemCodes: [],
    idempotencyKey: "a",
    now: T0,
  }).token;
  const second = checkIn(db, {
    serviceId: "general",
    phone: "9000000002",
    itemCodes,
    idempotencyKey: "b",
    now: T0 + 60_000,
  }).token;
  return { db, first, second };
}
const decide = { staffLabel: "Staff", now: T0 + 120_000 };
const order = (db: ReturnType<typeof testDb>) =>
  sortQueue(db.select().from(tokens).all()).map((t) => t.code);

test("a suggestion alone does not change queue order", () => {
  const { db } = setup(["chest_pain"]);
  expect(order(db)).toEqual(["GEN-001", "GEN-002"]);
});

test("confirming moves the token ahead and logs an audit row", () => {
  const { db, second } = setup(["chest_pain"]);
  const updated = decideTriage(db, { tokenId: second.id, decision: "urgent", ...decide });
  expect(updated.confirmedPriority).toBe("urgent");
  expect(updated.triageReviewedAt).toBe(decide.now);
  expect(order(db)).toEqual(["GEN-002", "GEN-001"]);
  expect(db.select().from(triageDecisions).all()[0]).toMatchObject({
    tokenCode: "GEN-002",
    suggested: "urgent",
    decision: "urgent",
    overrideReason: null,
  });
});

test("an override without a reason is rejected and changes nothing", () => {
  const { db, second } = setup(["chest_pain"]);
  expect(() => decideTriage(db, { tokenId: second.id, decision: "routine", ...decide })).toThrow(/reason/i);
  expect(db.select().from(tokens).where(eq(tokens.id, second.id)).get()!.triageReviewedAt).toBeNull();
  expect(db.select().from(triageDecisions).all()).toHaveLength(0);
});

test("an override with an unlisted reason is rejected", () => {
  const { db, second } = setup(["chest_pain"]);
  expect(() =>
    decideTriage(db, { tokenId: second.id, decision: "routine", overrideReason: "because", ...decide }),
  ).toThrow(expect.objectContaining({ status: 400 }));
});

test("an override with a reason logs suggestion, decision and reason", () => {
  const { db, second } = setup(["chest_pain"]);
  decideTriage(db, {
    tokenId: second.id,
    decision: "priority",
    overrideReason: "Assessed in person",
    ...decide,
  });
  expect(db.select().from(triageDecisions).all()[0]).toMatchObject({
    suggested: "urgent",
    decision: "priority",
    overrideReason: "Assessed in person",
    reasonsJson: JSON.stringify(["Chest pain"]),
  });
});

test("staff can raise a token with no suggestion and no reason", () => {
  const { db, first } = setup([]);
  expect(decideTriage(db, { tokenId: first.id, decision: "priority", ...decide }).confirmedPriority).toBe(
    "priority",
  );
});

test("deciding on a token that has left the queue is rejected", () => {
  const { db, first } = setup([]);
  transition(db, first.id, "cancelled", { now: T0, actor: "patient" });
  expect(() => decideTriage(db, { tokenId: first.id, decision: "urgent", ...decide })).toThrow(/no longer/i);
});

test("audit rows contain no phone data", () => {
  const { db, second } = setup(["chest_pain"]);
  decideTriage(db, { tokenId: second.id, decision: "urgent", ...decide });
  expect(JSON.stringify(db.select().from(triageDecisions).all())).not.toMatch(/9000000002|0002/);
});
