"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  announcementText,
  chosenLanguages,
  parseLanguages,
  pickVoice,
  speakingOrder,
  toggleLanguage,
  usableLanguages,
  type Language,
  type TokenCall,
} from "@/lib/queue/announcement";

export type AnnouncerStatus = "off" | "on" | "unavailable";

export const ANNOUNCER_LABEL: Record<AnnouncerStatus, string> = {
  off: "Turn on announcements",
  on: "Announcements on",
  unavailable: "Announcements are not available in this browser",
};

const SPEECH_RATE = 0.8;
const CHIME_MS = 700;
const PAUSE_MS = 500;
/** An online voice that cannot connect stays silent, so give up and move on to the next language. */
const SPEECH_START_MS = 5_000;
/** Browsers sometimes never report the end of speech, which would freeze every later announcement. */
const LONGEST_SPEECH_MS = 20_000;

const LANGUAGE_KEY = "pulsequeue.announcement-languages";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The selection is a convenience, so private windows and blocked storage simply use the default. */
function loadSelection(): Language[] {
  try {
    return parseLanguages(window.localStorage.getItem(LANGUAGE_KEY));
  } catch {
    return parseLanguages(null);
  }
}

function saveSelection(languages: Language[]) {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, JSON.stringify(languages));
  } catch {
    // Nothing to do: the selection still applies until the page is refreshed.
  }
}

function say(text: string, language: Language): Promise<void> {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(speechSynthesis.getVoices(), language, navigator.onLine);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.rate = SPEECH_RATE;
    const finish = () => {
      clearTimeout(noStart);
      clearTimeout(tooLong);
      resolve();
    };
    const noStart = setTimeout(() => {
      speechSynthesis.cancel();
      finish();
    }, SPEECH_START_MS);
    const tooLong = setTimeout(finish, LONGEST_SPEECH_MS);
    utterance.onstart = () => clearTimeout(noStart);
    utterance.onend = utterance.onerror = finish;
    speechSynthesis.speak(utterance);
  });
}

function playChime(audio: AudioContext) {
  [660, 880].forEach((frequency, index) => {
    const start = audio.currentTime + index * 0.25;
    const tone = audio.createOscillator();
    const gain = audio.createGain();
    tone.frequency.value = frequency;
    gain.gain.setValueAtTime(0.2, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
    tone.connect(gain).connect(audio.destination);
    tone.start(start);
    tone.stop(start + 0.4);
  });
}

/** Browsers only allow sound after a click, so announcements start from the toggle button. */
export function useAnnouncer() {
  const [status, setStatus] = useState<AnnouncerStatus>("off");
  const [usable, setUsable] = useState<Language[]>(["en"]);
  const [selected, setSelected] = useState<Language[]>(() =>
    typeof window === "undefined" ? parseLanguages(null) : loadSelection(),
  );
  const selection = useRef(selected);
  const enabled = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const queue = useRef<TokenCall[]>([]);
  const draining = useRef(false);

  const drain = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    while (enabled.current && queue.current.length > 0) {
      const call = queue.current.shift()!;
      const available = usableLanguages(speechSynthesis.getVoices(), navigator.onLine);
      setUsable(available);
      if (audio.current) playChime(audio.current);
      await wait(CHIME_MS);
      for (const language of speakingOrder(chosenLanguages(selection.current, available))) {
        if (!enabled.current) break;
        await say(announcementText(call, language), language);
        await wait(PAUSE_MS);
      }
    }
    draining.current = false;
  }, []);

  const announce = useCallback(
    (calls: TokenCall[]) => {
      if (!enabled.current || calls.length === 0) return;
      queue.current.push(...calls);
      void drain();
    },
    [drain],
  );

  function turnOff() {
    enabled.current = false;
    queue.current = [];
    speechSynthesis.cancel();
    setStatus("off");
  }

  function toggle() {
    if (enabled.current) return turnOff();
    if (!("speechSynthesis" in window)) return setStatus("unavailable");
    enabled.current = true;
    audio.current ??= new AudioContext();
    void audio.current.resume();
    setStatus("on");
    setUsable(usableLanguages(speechSynthesis.getVoices(), navigator.onLine));
    playChime(audio.current);
    void say("Announcements are on.", "en");
  }

  function chooseLanguage(language: Language) {
    const next = toggleLanguage(selection.current, language);
    selection.current = next;
    setSelected(next);
    saveSelection(next);
  }

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const refresh = () => setUsable(usableLanguages(speechSynthesis.getVoices(), navigator.onLine));
    speechSynthesis.addEventListener("voiceschanged", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  useEffect(
    () => () => {
      enabled.current = false;
      queue.current = [];
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      void audio.current?.close();
    },
    [],
  );

  return { status, usable, selected, chooseLanguage, toggle, announce };
}
