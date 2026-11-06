import { expect, test } from "vitest";
import { needsWaitReview, sortQueue } from "@/lib/queue/order";
import type { Priority } from "@/lib/types";
import { T0 } from "./helpers";

const t = (code: string, confirmedPriority: Priority, checkedInAt: number) => ({
  code,
  confirmedPriority,
  checkedInAt,
});

test("sorts by confirmed priority, then check-in time, then code", () => {
  const sorted = sortQueue([
    t("D", "routine", 1),
    t("C", "priority", 5),
    t("B", "urgent", 9),
    t("A2", "routine", 0),
    t("A1", "routine", 0),
  ]);
  expect(sorted.map((x) => x.code)).toEqual(["B", "C", "A1", "A2", "D"]);
});

test("routine past 45 minutes is flagged but not moved", () => {
  const old = t("OLD", "routine", T0);
  const fresh = t("NEW", "urgent", T0 + 1);
  const now = T0 + 45 * 60_000;
  expect(needsWaitReview(old, now)).toBe(true);
  expect(sortQueue([old, fresh])[0].code).toBe("NEW");
});

test("routine under 45 minutes and raised tokens are not flagged", () => {
  const now = T0 + 44 * 60_000;
  expect(needsWaitReview(t("A", "routine", T0), now)).toBe(false);
  expect(needsWaitReview(t("B", "priority", T0 - 90 * 60_000), now)).toBe(false);
});
