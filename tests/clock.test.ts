import { expect, test } from "vitest";
import { demoNow, getSetting, setClock, setSetting } from "@/lib/clock";
import { testDb } from "./helpers";

test("demo clock ticks with real time from its base", () => {
  const db = testDb();
  setClock(db, 1000, 5000);
  expect(demoNow(db, 5750)).toBe(1750);
});

test("settings round-trip and overwrite", () => {
  const db = testDb();
  setSetting(db, "k", "a");
  setSetting(db, "k", "b");
  expect(getSetting(db, "k")).toBe("b");
  expect(getSetting(db, "missing")).toBeNull();
});
