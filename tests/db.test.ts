import { expect, test } from "vitest";
import { insertRawToken, testDb } from "./helpers";

test("rejects a second active token for the same phone and service", () => {
  const db = testDb();
  insertRawToken(db, { code: "GEN-001", phoneHash: "h", status: "waiting" });
  expect(() => insertRawToken(db, { code: "GEN-002", phoneHash: "h", status: "called" })).toThrow(/UNIQUE/);
});

test("allows a new active token once the old one is final", () => {
  const db = testDb();
  insertRawToken(db, { code: "GEN-001", phoneHash: "h", status: "completed" });
  expect(() => insertRawToken(db, { code: "GEN-002", phoneHash: "h", status: "waiting" })).not.toThrow();
});

test("allows the same phone at a different service", () => {
  const db = testDb();
  insertRawToken(db, { code: "GEN-001", phoneHash: "h", status: "waiting" });
  expect(() =>
    insertRawToken(db, { code: "LAB-001", phoneHash: "h", status: "waiting", serviceId: "lab" }),
  ).not.toThrow();
});
