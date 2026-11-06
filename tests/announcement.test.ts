import { expect, test } from "vitest";
import { announcementText, findNewCalls, pickVoice, spellCode } from "@/lib/queue/announcement";

const call = (code: string, counterLabel = "Counter 2", serviceName = "General OPD") => ({
  code,
  counterLabel,
  serviceName,
});
const voice = (name: string, lang: string, localService = true) => ({ name, lang, localService });

test("a token code is spelled out so that it is easy to follow", () => {
  expect(spellCode("GEN-044")).toBe("G E N, 0 4 4");
});

test("the announcement names the token, the service and the counter", () => {
  expect(announcementText(call("LAB-007", "Counter 1", "Lab"))).toBe("Token L A B, 0 0 7. Please go to Lab, Counter 1.");
});

test("the announcement keeps to the token, service and counter fields", () => {
  const withExtra = { ...call("GEN-001"), staffName: "Dr. Secret", priority: "urgent" };
  expect(announcementText(withExtra)).not.toMatch(/Secret|urgent/);
});

test("patients already at a counter are not announced on first load", () => {
  expect(findNewCalls(null, [call("GEN-001")])).toEqual([]);
});

test("only a token that was not on the board before is announced", () => {
  expect(findNewCalls(["GEN-001"], [call("GEN-001"), call("GEN-002")])).toEqual([call("GEN-002")]);
});

test("a recalled token that is called again is announced again", () => {
  expect(findNewCalls(["GEN-002"], [call("GEN-001"), call("GEN-002")])).toEqual([call("GEN-001")]);
});

test("the Indian English voice wins, even when listed last", () => {
  expect(pickVoice([voice("Zira", "en-US"), voice("Heera", "en-IN")])?.name).toBe("Heera");
});

test("a voice that needs the internet loses to one on the laptop", () => {
  expect(pickVoice([voice("Online India", "en-IN", false), voice("Zira", "en-US")])?.name).toBe("Zira");
});

test("an online English voice is used when no installed one exists", () => {
  expect(pickVoice([voice("Online India", "en-IN", false), voice("Hindi", "hi-IN")])?.name).toBe("Online India");
});

test("no English voice leaves the browser default in place", () => {
  expect(pickVoice([voice("Hindi", "hi-IN")])).toBeUndefined();
});
