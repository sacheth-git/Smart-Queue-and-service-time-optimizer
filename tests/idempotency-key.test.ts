import { afterEach, expect, test, vi } from "vitest";
import { newIdempotencyKey } from "@/lib/queue/idempotency-key";
import { checkInSchema } from "@/lib/api/schemas";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("a key can be made on a plain http address, where browsers hide randomUUID", () => {
  vi.stubGlobal("crypto", { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
  const key = newIdempotencyKey();
  expect(key).toMatch(/^[0-9a-f]{32}$/);
  expect(checkInSchema.shape.idempotencyKey.safeParse(key).success).toBe(true);
});

test("each attempt gets a different key", () => {
  expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
});
