"use client";

import { Activity, ArrowLeft, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { findNewCalls, LANGUAGE_NAMES, type TokenCall } from "@/lib/queue/announcement";
import type { DisplayService } from "@/lib/queue/views";
import { cn } from "@/lib/utils";
import { type AnnouncerStatus, useAnnouncer } from "./use-announcer";
import { usePoll } from "./use-poll";

const ANNOUNCER_LABEL: Record<AnnouncerStatus, string> = {
  off: "Turn on announcements",
  on: "Announcements on",
  unavailable: "Announcements are not available in this browser",
};

export function DisplayBoard() {
  const { data } = usePoll<{ services: DisplayService[] }>("/api/display");
  const [known, setKnown] = useState<string[] | null>(null);
  const [freshCalls, setFreshCalls] = useState<TokenCall[]>([]);
  const { status, languages, toggle, announce } = useAnnouncer();

  const current =
    data?.services.flatMap((s) =>
      s.nowServing.map(({ code, counterLabel }) => ({ code, counterLabel, serviceName: s.serviceName })),
    ) ?? [];
  const currentCodes = current.map((call) => call.code);
  if (data && currentCodes.join() !== known?.join()) {
    setFreshCalls(findNewCalls(known, current));
    setKnown(currentCodes);
  }
  const fresh = new Set(freshCalls.map((call) => call.code));

  useEffect(() => announce(freshCalls), [freshCalls, announce]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 p-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3 text-2xl font-semibold">
          <Activity className="size-7 text-teal-400" /> Now serving
        </div>
        <div className="flex items-center gap-4">
          {status === "on" && (
            <span className="text-sm text-slate-300">
              {languages.map((language) => LANGUAGE_NAMES[language]).join(" · ")}
            </span>
          )}
          <button
            type="button"
            aria-pressed={status === "on"}
            onClick={toggle}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              status === "on"
                ? "border-teal-400 bg-teal-900 text-teal-100"
                : "border-slate-700 text-slate-300 hover:bg-slate-800",
            )}
          >
            {status === "on" ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            {ANNOUNCER_LABEL[status]}
          </button>
          <Link href="/staff" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300">
            <ArrowLeft className="size-4" /> Back
          </Link>
        </div>
      </header>

      {!data ? (
        <div className="grid flex-1 animate-pulse gap-4 rounded-xl bg-slate-900" />
      ) : (
        <div className="grid flex-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {data.services.map((service) => (
            <section key={service.serviceId} className="flex flex-col rounded-xl bg-slate-900 p-5">
              <h2 className="mb-4 text-xl font-semibold text-teal-300">{service.serviceName}</h2>
              <div className="flex flex-col gap-2">
                {service.nowServing.length === 0 && <p className="text-lg text-slate-500">No one at a counter</p>}
                {service.nowServing.map((item) => (
                  <div
                    key={item.code}
                    className={cn(
                      "flex flex-col gap-1 rounded-xl bg-slate-800 px-4 py-3",
                      fresh.has(item.code) && "animate-pulse bg-teal-800",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-3xl font-bold whitespace-nowrap">{item.code}</span>
                      <span className="text-base whitespace-nowrap text-slate-300">{item.counterLabel}</span>
                    </div>
                    {item.staffName && <span className="text-sm text-slate-400">{item.staffName}</span>}
                  </div>
                ))}
              </div>
              <h3 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-slate-400 uppercase">Next</h3>
              {service.upNext.length === 0 && <p className="text-slate-500">Queue is clear</p>}
              <div className="grid grid-cols-2 gap-2">
                {service.upNext.map((code) => (
                  <span key={code} className="font-mono text-xl text-slate-200">
                    {code}
                  </span>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <p className="mt-4 text-center text-sm text-slate-500">
        Called in order of need. Please tell staff if you feel worse while waiting.
      </p>
    </div>
  );
}
