import { expect, test } from "vitest";
import { isLocalOnlyHost, tokenPathFromParam, trackUrl } from "@/lib/queue/track-link";

test("the tracking link carries the token code as a query parameter", () => {
  expect(trackUrl("http://192.168.1.102:3000", "GEN-044")).toBe("http://192.168.1.102:3000?token=GEN-044");
});

test("a scanned token code opens that token's live page", () => {
  expect(tokenPathFromParam("GEN-044")).toBe("/t/GEN-044");
});

test("the link survives a round trip through a real URL", () => {
  const scanned = new URL(trackUrl("http://192.168.1.102:3000", "GEN-044"));
  expect(tokenPathFromParam(scanned.searchParams.get("token") ?? undefined)).toBe("/t/GEN-044");
});

test("a hostile token value cannot change the path", () => {
  expect(tokenPathFromParam("../admin")).toBe("/t/..%2Fadmin");
  expect(tokenPathFromParam("//evil.example")).toBe("/t/%2F%2Fevil.example");
});

test.each([
  [undefined],
  [""],
  ["   "],
  [["GEN-1", "GEN-2"]],
])("no usable token leaves the home page alone: %j", (value) => {
  expect(tokenPathFromParam(value)).toBeNull();
});

test.each([
  ["localhost", true],
  ["127.0.0.1", true],
  ["[::1]", true],
  ["192.168.1.102", false],
  ["pulsequeue.example", false],
])("%s reachable only from this machine: %s", (host, expected) => {
  expect(isLocalOnlyHost(host)).toBe(expected);
});
