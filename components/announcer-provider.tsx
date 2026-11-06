"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { callsOnBoard, findNewCalls, type TokenCall } from "@/lib/queue/announcement";
import type { DisplayService } from "@/lib/queue/views";
import { useAnnouncer } from "./use-announcer";
import { usePoll } from "./use-poll";

type Announcer = ReturnType<typeof useAnnouncer>;

const AnnouncerContext = createContext<Announcer | null>(null);

export function useAnnouncements(): Announcer {
  const announcer = useContext(AnnouncerContext);
  if (!announcer) throw new Error("useAnnouncements must be used inside AnnouncerProvider");
  return announcer;
}

function CallWatcher({ announce }: { announce: (calls: TokenCall[]) => void }) {
  const { data } = usePoll<{ services: DisplayService[] }>("/api/display");
  const known = useRef<string[] | null>(null);

  useEffect(() => {
    if (!data) return;
    const current = callsOnBoard(data.services);
    announce(findNewCalls(known.current, current));
    known.current = current.map((call) => call.code);
  }, [data, announce]);

  return null;
}

/** Sits in the root layout, so announcements keep running while moving between pages. */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const announcer = useAnnouncer();
  return (
    <AnnouncerContext.Provider value={announcer}>
      {children}
      {announcer.status === "on" && <CallWatcher announce={announcer.announce} />}
    </AnnouncerContext.Provider>
  );
}
