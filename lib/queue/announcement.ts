export type TokenCall = { code: string; counterLabel: string; serviceName: string };
export type Language = "en" | "kn" | "hi";
type VoiceInfo = { lang: string; localService: boolean };
type Phrases = { token: string; go: string; counter: string; digits: string[]; services: Record<string, string> };

export const LANGUAGE_NAMES: Record<Language, string> = { en: "English", kn: "ಕನ್ನಡ", hi: "हिन्दी" };

const LANGUAGES: Language[] = ["en", "kn", "hi"];

const PHRASES: Record<Exclude<Language, "en">, Phrases> = {
  hi: {
    token: "टोकन",
    go: "कृपया जाएं:",
    counter: "काउंटर",
    digits: ["शून्य", "एक", "दो", "तीन", "चार", "पांच", "छह", "सात", "आठ", "नौ"],
    services: {
      "General OPD": "जनरल ओपीडी",
      Pediatrics: "बाल रोग विभाग",
      Lab: "लैब",
      Pharmacy: "फार्मेसी",
    },
  },
  kn: {
    token: "ಟೋಕನ್",
    go: "ದಯವಿಟ್ಟು ಹೋಗಿ:",
    counter: "ಕೌಂಟರ್",
    digits: ["ಸೊನ್ನೆ", "ಒಂದು", "ಎರಡು", "ಮೂರು", "ನಾಲ್ಕು", "ಐದು", "ಆರು", "ಏಳು", "ಎಂಟು", "ಒಂಬತ್ತು"],
    services: {
      "General OPD": "ಜನರಲ್ ಒಪಿಡಿ",
      Pediatrics: "ಮಕ್ಕಳ ವಿಭಾಗ",
      Lab: "ಲ್ಯಾಬ್",
      Pharmacy: "ಔಷಧಾಲಯ",
    },
  },
};

/** Reads "GEN-044" one character at a time, with a pause between the two parts. */
export function spellCode(code: string): string {
  return code
    .split("-")
    .map((part) => part.split("").join(" "))
    .join(", ");
}

function digitWords(text: string, digits: string[]): string {
  return text
    .split("")
    .map((digit) => digits[Number(digit)])
    .join(" ");
}

/** Public, so token, service and counter only. Every service has a Counter 1, so the service is needed. */
export function announcementText({ code, counterLabel, serviceName }: TokenCall, language: Language = "en"): string {
  if (language === "en") return `Token ${spellCode(code)}. Please go to ${serviceName}, ${counterLabel}.`;

  const phrases = PHRASES[language];
  const [letters, number] = code.split("-");
  const counterNumber = counterLabel.match(/\d+/)?.[0] ?? "";
  const service = phrases.services[serviceName] ?? serviceName;
  return (
    `${phrases.token} ${letters.split("").join(" ")}, ${digitWords(number, phrases.digits)}. ` +
    `${phrases.go} ${service}, ${phrases.counter} ${digitWords(counterNumber, phrases.digits)}.`
  );
}

type BoardService = { serviceName: string; nowServing: { code: string; counterLabel: string }[] };

/** Every token at a counter right now, with only the fields that may be read aloud. */
export function callsOnBoard(services: BoardService[]): TokenCall[] {
  return services.flatMap(({ serviceName, nowServing }) =>
    nowServing.map(({ code, counterLabel }) => ({ code, counterLabel, serviceName })),
  );
}

/** Tokens newly on the board. With no earlier look at the board, nothing counts as new. */
export function findNewCalls<T extends { code: string }>(known: string[] | null, current: T[]): T[] {
  if (!known) return [];
  return current.filter((call) => !known.includes(call.code));
}

const speaks = (voice: VoiceInfo, language: Language) => voice.lang.toLowerCase().startsWith(language);
const isIndian = (voice: VoiceInfo) => voice.lang.replace("_", "-").toLowerCase().endsWith("-in");

/** Prefers voices on the laptop, because the online ones stop working without the internet. */
export function pickVoice<T extends VoiceInfo>(
  voices: readonly T[],
  language: Language = "en",
  online = true,
): T | undefined {
  const matching = voices.filter((voice) => speaks(voice, language) && (online || voice.localService));
  const installed = matching.filter((voice) => voice.localService);
  return installed.find(isIndian) ?? installed[0] ?? matching.find(isIndian) ?? matching[0];
}

/** English always stays, since the browser can fall back to its default voice for it. */
export function usableLanguages(voices: readonly VoiceInfo[], online: boolean): Language[] {
  return LANGUAGES.filter((language) => language === "en" || pickVoice(voices, language, online));
}

/** Each language is said once. A lone language is said twice, so that a missed call can be caught. */
export function speakingOrder(languages: Language[]): Language[] {
  return languages.length > 1 ? languages : [...languages, ...languages];
}
