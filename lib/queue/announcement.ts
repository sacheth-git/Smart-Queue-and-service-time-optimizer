export type TokenCall = { code: string; counterLabel: string; serviceName: string };
type VoiceInfo = { lang: string; localService: boolean };

/** Reads "GEN-044" one character at a time, with a pause between the two parts. */
export function spellCode(code: string): string {
  return code
    .split("-")
    .map((part) => part.split("").join(" "))
    .join(", ");
}

/** Public, so token, service and counter only. Every service has a Counter 1, so the service is needed. */
export function announcementText({ code, counterLabel, serviceName }: TokenCall): string {
  return `Token ${spellCode(code)}. Please go to ${serviceName}, ${counterLabel}.`;
}

/** Tokens newly on the board. With no earlier look at the board, nothing counts as new. */
export function findNewCalls<T extends { code: string }>(known: string[] | null, current: T[]): T[] {
  if (!known) return [];
  return current.filter((call) => !known.includes(call.code));
}

const isIndianEnglish = (voice: VoiceInfo) => voice.lang.replace("_", "-").toLowerCase() === "en-in";
const isEnglish = (voice: VoiceInfo) => voice.lang.toLowerCase().startsWith("en");

/** Prefers voices on the laptop, because the online ones stop working without Wi-Fi. */
export function pickVoice<T extends VoiceInfo>(voices: readonly T[]): T | undefined {
  const installed = voices.filter((voice) => voice.localService);
  return (
    installed.find(isIndianEnglish) ??
    installed.find(isEnglish) ??
    voices.find(isIndianEnglish) ??
    voices.find(isEnglish)
  );
}
