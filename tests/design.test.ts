import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { PriorityBadge, priorityLabel } from "@/components/staff/priority-badge";
import type { Priority } from "@/lib/types";

const badge = (level: Priority) => renderToStaticMarkup(createElement(PriorityBadge, { level }));

test("levels use the agreed on-screen names", () => {
  expect(priorityLabel("urgent")).toBe("Critical");
  expect(priorityLabel("priority")).toBe("Urgent");
  expect(priorityLabel("routine")).toBe("Routine");
});

test("the top level is a soft red, bold badge", () => {
  for (const name of ["bg-red-100", "text-red-700", "border-red-200", "font-semibold"]) {
    expect(badge("urgent")).toContain(name);
  }
});

test("the middle level is an amber badge", () => {
  for (const name of ["bg-amber-100", "text-amber-700", "border-amber-200"]) {
    expect(badge("priority")).toContain(name);
  }
});

test("routine is a blue badge", () => {
  for (const name of ["bg-blue-100", "text-blue-700", "border-blue-200"]) {
    expect(badge("routine")).toContain(name);
  }
});
