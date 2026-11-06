import { beforeEach, expect, test } from "vitest";
import { POST as checkInRoute } from "@/app/api/check-in/route";
import { GET as displayRoute } from "@/app/api/display/route";
import { POST as tokenAction } from "@/app/api/staff/tokens/[id]/action/route";
import { POST as triageRoute } from "@/app/api/staff/tokens/[id]/triage/route";
import { GET as tokenRoute } from "@/app/api/tokens/[code]/route";
import { POST as cancelRoute } from "@/app/api/tokens/[code]/cancel/route";
import { setClock } from "@/lib/clock";
import { T0, testDb } from "./helpers";

const post = (body: unknown) =>
  new Request("http://test/api", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const params = <T,>(value: T) => ({ params: Promise.resolve(value) });
const valid = { serviceId: "general", phone: "9876543210", itemCodes: [], idempotencyKey: "k1" };

beforeEach(() => {
  const db = testDb();
  setClock(db, T0);
  (globalThis as unknown as { __pulsequeueDb: unknown }).__pulsequeueDb = db;
});

test("check-in returns a code and outcome only", async () => {
  const res = await checkInRoute(post({ ...valid, itemCodes: ["chest_pain"] }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ code: "GEN-001", outcome: "created" });
});

test("check-in with a 9-digit phone returns 400 with a message", async () => {
  const res = await checkInRoute(post({ ...valid, phone: "987654321" }));
  expect(res.status).toBe(400);
  expect((await res.json()).error.message).toMatch(/10-digit/);
});

test("check-in with bad JSON returns 400", async () => {
  expect((await checkInRoute(post("{nope"))).status).toBe(400);
});

test("check-in with a missing field returns 400", async () => {
  expect((await checkInRoute(post({ phone: "9876543210" }))).status).toBe(400);
});

test("check-in with an unknown service returns 400", async () => {
  expect((await checkInRoute(post({ ...valid, serviceId: "x" }))).status).toBe(400);
});

test("check-in with an unknown item code returns 400", async () => {
  expect((await checkInRoute(post({ ...valid, itemCodes: ["x"] }))).status).toBe(400);
});

test("an unknown token returns 404", async () => {
  const res = await tokenRoute(new Request("http://test"), params({ code: "GEN-999" }));
  expect(res.status).toBe(404);
});

test("a token view has no priority fields", async () => {
  await checkInRoute(post({ ...valid, itemCodes: ["chest_pain"] }));
  const res = await tokenRoute(new Request("http://test"), params({ code: "GEN-001" }));
  expect(await res.text()).not.toMatch(/priority|urgent|chest/i);
});

test("the display payload has no priority fields", async () => {
  await checkInRoute(post({ ...valid, itemCodes: ["chest_pain"] }));
  expect(await (await displayRoute(new Request("http://test"), params({}))).text()).not.toMatch(
    /priority|urgent|chest/i,
  );
});

test("a patient can cancel, then a second cancel returns 409 with a message", async () => {
  await checkInRoute(post(valid));
  expect((await cancelRoute(post({}), params({ code: "GEN-001" }))).status).toBe(200);
  const again = await cancelRoute(post({}), params({ code: "GEN-001" }));
  expect(again.status).toBe(409);
  expect((await again.json()).error.message).toMatch(/Cannot move/);
});

test("an illegal staff action returns 409", async () => {
  await checkInRoute(post(valid));
  const { staffView } = await import("@/lib/queue/views");
  const { getDb } = await import("@/lib/db/client");
  const id = staffView(getDb(), T0).services[0].queue[0].id;
  expect((await tokenAction(post({ action: "complete" }), params({ id }))).status).toBe(409);
});

test("an unknown staff action returns 400", async () => {
  expect((await tokenAction(post({ action: "explode" }), params({ id: "x" }))).status).toBe(400);
});

test("an override without a reason returns 400 through the route", async () => {
  await checkInRoute(post({ ...valid, itemCodes: ["chest_pain"] }));
  const { staffView } = await import("@/lib/queue/views");
  const { getDb } = await import("@/lib/db/client");
  const id = staffView(getDb(), T0).pendingReview[0].id;
  expect((await triageRoute(post({ decision: "routine" }), params({ id }))).status).toBe(400);
});
