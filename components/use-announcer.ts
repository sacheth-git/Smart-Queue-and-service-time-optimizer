"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { announcementText, pickVoice, type TokenCall } from "@/lib/queue/announcement";

export type AnnouncerStatus = "off" | "on" | "unavailable";

const SPEECH_RATE = 0.8;
const CHIME_MS = 700;
const PAUSE_MS = 500;
/** Browsers sometimes never report the end of speech, which would freeze every later announcement. */
const LONGEST_SPEECH_MS = 15_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function say(text: string): Promise<void> {
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(speechSynthesis.getVoices());
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.rate = SPEECH_RATE;
    const timer = setTimeout(resolve, LONGEST_SPEECH_MS);
    utterance.onend = utterance.onerror = () => {
      clearTimeout(timer);
      resolve();
    };
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
  const enabled = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const queue = useRef<TokenCall[]>([]);
  const draining = useRef(false);

  const drain = useCallback(async () => {
    if (draining.current) return;
    draining.current = true;
    while (enabled.current && queue.current.length > 0) {
      const text = announcementText(queue.current.shift()!);
      if (audio.current) playChime(audio.current);
      await wait(CHIME_MS);
      await say(text);
      await wait(PAUSE_MS);
      if (enabled.current) await say(text);
      await wait(PAUSE_MS);
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
    playChime(audio.current);
    void say("Announcements are on.");
  }

  useEffect(
    () => () => {
      enabled.current = false;
      queue.current = [];
      if ("speechSynthesis" in window) speechSynthesis.cancel();
      void audio.current?.close();
    },
    [],
  );

  return { status, toggle, announce };
}
