"use client";

import { Activity, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { DisplayService } from "@/lib/queue/views";
import { cn } from "@/lib/utils";
import { usePoll } from "./use-poll";

export function DisplayBoard() {
  const { data } = usePoll<{ services: DisplayService[] }>("/api/display");
  const [known, setKnown] = useState<string[] | null>(null);
  const [freshCodes, setFreshCodes] = useState<string[]>([]);

  const current = data?.services.flatMap((s) => s.nowServing.map((n) => n.code)) ?? [];
  if (data && current.join() !== known?.join()) {
    setFreshCodes(known ? current.filter((code) => !known.includes(code)) : []);
    setKnown(current);
  }
  const fresh = new Set(freshCodes);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 p-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3 text-2xl font-semibold">
          <Activity className="size-7 text-teal-400" /> Now serving
        </div>
        <Link href="/staff" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300">
          <ArrowLeft className="size-4" /> Back
        </Link>
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
                      "flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3",
                      fresh.has(item.code) && "animate-pulse bg-teal-800",
                    )}
                  >
                    <span className="font-mono text-3xl font-bold">{item.code}</span>
                    <span className="text-base text-slate-300">{item.counterLabel}</span>
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
