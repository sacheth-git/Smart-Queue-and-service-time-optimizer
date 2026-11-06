import { expect, test } from "vitest";
import {
  announcementText,
  callsOnBoard,
  chosenLanguages,
  findNewCalls,
  languageHint,
  parseLanguages,
  pickVoice,
  speakingOrder,
  spellCode,
  toggleLanguage,
  usableLanguages,
} from "@/lib/queue/announcement";

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

test("every token at a counter is listed with its own service", () => {
  const board = [
    { serviceName: "Lab", nowServing: [{ code: "LAB-001", counterLabel: "Counter 1", staffName: "Dr. Secret" }] },
    { serviceName: "Pharmacy", nowServing: [{ code: "PHA-002", counterLabel: "Counter 2", staffName: null }] },
    { serviceName: "Pediatrics", nowServing: [] },
  ];
  expect(callsOnBoard(board)).toEqual([
    { code: "LAB-001", counterLabel: "Counter 1", serviceName: "Lab" },
    { code: "PHA-002", counterLabel: "Counter 2", serviceName: "Pharmacy" },
  ]);
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

const LAPTOP = [
  voice("Ravi", "en-IN"),
  voice("Sapna Online", "kn-IN", false),
  voice("Swara Online", "hi-IN", false),
];

test("Hindi reads the digits and the counter number as words", () => {
  expect(announcementText(call("GEN-044"), "hi")).toBe(
    "टोकन G E N, शून्य चार चार. कृपया जाएं: जनरल ओपीडी, काउंटर दो.",
  );
});

test("Kannada reads the digits and the counter number as words", () => {
  expect(announcementText(call("LAB-007", "Counter 1", "Lab"), "kn")).toBe(
    "ಟೋಕನ್ L A B, ಸೊನ್ನೆ ಸೊನ್ನೆ ಏಳು. ದಯವಿಟ್ಟು ಹೋಗಿ: ಲ್ಯಾಬ್, ಕೌಂಟರ್ ಒಂದು.",
  );
});

test("a service with no translation keeps its English name", () => {
  expect(announcementText(call("DEN-001", "Counter 1", "Dental"), "hi")).toContain("Dental");
});

test("each language is matched to its own voice", () => {
  expect(pickVoice(LAPTOP, "kn")?.name).toBe("Sapna Online");
  expect(pickVoice(LAPTOP, "hi")?.name).toBe("Swara Online");
});

test("a language with no voice is skipped rather than read by the wrong voice", () => {
  expect(pickVoice([voice("Ravi", "en-IN")], "kn")).toBeUndefined();
});

test("with the internet off, online voices are not used", () => {
  expect(pickVoice(LAPTOP, "kn", false)).toBeUndefined();
  expect(usableLanguages(LAPTOP, false)).toEqual(["en"]);
});

test("with the internet on, every language with a voice is used, English first", () => {
  expect(usableLanguages(LAPTOP, true)).toEqual(["en", "kn", "hi"]);
});

test("English stays available even when the browser lists no voices", () => {
  expect(usableLanguages([], true)).toEqual(["en"]);
});

test("several languages are each spoken once", () => {
  expect(speakingOrder(["en", "kn", "hi"])).toEqual(["en", "kn", "hi"]);
});

test("English alone is spoken twice", () => {
  expect(speakingOrder(["en"])).toEqual(["en", "en"]);
});

test("Kannada alone is spoken twice, with no English", () => {
  expect(speakingOrder(chosenLanguages(["kn"], ["en", "kn", "hi"]))).toEqual(["kn", "kn"]);
});

test("only the selected languages are spoken", () => {
  expect(chosenLanguages(["en", "hi"], ["en", "kn", "hi"])).toEqual(["en", "hi"]);
});

test("a selected language with no voice right now is left out", () => {
  expect(chosenLanguages(["en", "kn"], ["en"])).toEqual(["en"]);
});

test("a call is never silent: English steps in when no selected language can be spoken", () => {
  expect(chosenLanguages(["kn", "hi"], ["en"])).toEqual(["en"]);
});

test("a language can be added and keeps the fixed order", () => {
  expect(toggleLanguage(["hi"], "en")).toEqual(["en", "hi"]);
});

test("a language can be removed", () => {
  expect(toggleLanguage(["en", "hi"], "en")).toEqual(["hi"]);
});

test("the last selected language cannot be removed", () => {
  expect(toggleLanguage(["kn"], "kn")).toEqual(["kn"]);
});

test("no hint when every language can be spoken", () => {
  expect(languageHint(["en", "kn", "hi"], true)).toBeNull();
});

test("with no internet, the hint says so", () => {
  expect(languageHint(["en"], false)).toBe("Kannada and Hindi need the internet.");
});

test("online with no voice, like in Chrome, the hint points to Edge", () => {
  expect(languageHint(["en"], true)).toBe("For Kannada and Hindi, open this page in Microsoft Edge.");
});

test("the hint names only the language that is missing", () => {
  expect(languageHint(["en", "hi"], true)).toBe("For Kannada, open this page in Microsoft Edge.");
});

test("a saved selection is restored", () => {
  expect(parseLanguages('["kn","hi"]')).toEqual(["kn", "hi"]);
});

test.each([
  ["nothing saved", null],
  ["broken data", "{oops"],
  ["not a list", '"kn"'],
  ["unknown languages only", '["fr"]'],
  ["an empty list", "[]"],
])("%s falls back to every language", (_name, saved) => {
  expect(parseLanguages(saved)).toEqual(["en", "kn", "hi"]);
});
