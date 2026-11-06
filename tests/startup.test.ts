import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { demoNow } from "@/lib/clock";
import { openDemoDb } from "@/lib/db/client";
import { tokenEvents, tokens } from "@/lib/db/schema";
import { T0 } from "./helpers";

test("every app start restores the 11:00 morning, even from an old database", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pulsequeue-"));
  const file = path.join(dir, "demo.db");

  const first = openDemoDb(file, T0);
  first.delete(tokenEvents).run();
  first.delete(tokens).run();
  const sixHoursLater = T0 + 6 * 3_600_000;
  expect(new Date(demoNow(first, sixHoursLater)).getHours()).toBe(17);

  const second = openDemoDb(file, sixHoursLater);
  expect(new Date(demoNow(second, sixHoursLater)).getHours()).toBe(11);
  expect(second.select().from(tokens).all().length).toBeGreaterThan(50);
}, 15_000);
