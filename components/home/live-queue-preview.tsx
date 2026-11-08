"use client";

import { Megaphone, WifiOff } from "lucide-react";
import { useState } from "react";
import { usePoll } from "@/components/use-poll";
import type { WaitEstimate } from "@/lib/estimate/wait";
import { callsOnBoard, findNewCalls, type TokenCall } from "@/lib/queue/announcement";
import type { HomeService } from "@/lib/queue/views";
import { cn } from "@/lib/utils";

function waitText(estimate: WaitEstimate): string {
  return estimate.kind === "range" ? `${estimate.lowMin}–${estimate.highMin}` : "–";
}

/** Read-only view of the real queue for the public home page. Staff actions live on the staff console. */
export function LiveQueuePreview() {
  const { data, error } = usePoll<{ services: HomeService[] }>("/api/home");
  const [picked, setPicked] = useState<string | null>(null);
  const [known, setKnown] = useState<string[] | null>(null);
  const [lastCall, setLastCall] = useState<TokenCall | null>(null);
  const [freshCodes, setFreshCodes] = useState<string[]>([]);

  const calls = data ? callsOnBoard(data.services) : [];
  const codes = calls.map((call) => call.code);
  if (data && codes.join() !== known?.join()) {
    const fresh = findNewCalls(known, calls);
    if (fresh.length > 0) setLastCall(fresh[fresh.length - 1]);
    setFreshCodes(fresh.map((call) => call.code));
    setKnown(codes);
  }

  const service = data?.services.find((s) => s.serviceId === picked) ?? data?.services[0];

  return (
    <div
      aria-label="Live queue"
      className="min-w-0 overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_2px_4px_rgb(16_42_67/0.04),0_24px_48px_-16px_rgb(16_42_67/0.22)]"
    >
      <div className="flex items-center gap-3 border-b border-slate-100 px-[18px] py-4">
        <span className="flex items-center gap-2 font-semibold">
          <span className="relative flex size-2" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Live queue
        </span>
        <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
          Demo data
        </span>
      </div>

      {!data ? (
        error ? (
          <p className="flex items-center gap-2 px-[18px] py-16 text-sm text-navy-soft">
            <WifiOff className="size-4" /> Reconnecting to the queue...
          </p>
        ) : (
          <div className="m-[18px] h-80 animate-pulse rounded-xl bg-slate-100" aria-label="Loading the queue" />
        )
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Service"
            className="flex gap-1.5 overflow-x-auto px-[18px] pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {data.services.map((s) => (
              <button
                key={s.serviceId}
                role="tab"
                type="button"
                aria-selected={s.serviceId === service?.serviceId}
                onClick={() => setPicked(s.serviceId)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  s.serviceId === service?.serviceId
                    ? "border-navy bg-navy text-white"
                    : "border-line text-navy-soft hover:border-slate-300 hover:text-navy",
                )}
              >
                {s.serviceName}
                <span className="ml-1.5 font-mono opacity-75">{s.waiting}</span>
              </button>
            ))}
          </div>

          {service && (
            <>
              <dl className="grid grid-cols-2 gap-2.5 px-[18px] py-3.5 sm:grid-cols-3">
                <div className="min-w-0 rounded-xl bg-canvas px-3 py-2.5">
                  <dt className="text-xs font-medium text-slate-500">Waiting now</dt>
                  <dd className="text-xl font-bold tabular-nums">{service.waiting}</dd>
                </div>
                <div className="min-w-0 rounded-xl bg-canvas px-3 py-2.5">
                  <dt className="text-xs font-medium text-slate-500">Wait if you join now</dt>
                  <dd className="text-xl font-bold tabular-nums">
                    {waitText(service.joinNowEstimate)}
                    <span className="ml-1 text-xs font-medium text-slate-500">
                      {service.joinNowEstimate.kind === "range" ? "min, est." : "no counter open"}
                    </span>
                  </dd>
                </div>
                <div className="col-span-2 min-w-0 rounded-xl bg-canvas px-3 py-2.5 sm:col-span-1">
                  <dt className="text-xs font-medium text-slate-500">Counters open</dt>
                  <dd className="text-xl font-bold tabular-nums">{service.openCounters}</dd>
                </div>
              </dl>

              <h3 className="px-[18px] pt-1 pb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Now serving
              </h3>
              {service.nowServing.length === 0 ? (
                <p className="px-[18px] pb-3.5 text-sm text-slate-500">No one at a counter</p>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 px-[18px] pb-3.5 sm:grid-cols-3">
                  {service.nowServing.map((item) => (
                    <div
                      key={item.code}
                      className={cn(
                        "min-w-0 rounded-xl border border-line px-3 py-2.5 transition-colors duration-500",
                        freshCodes.includes(item.code) && "border-brand bg-mint",
                      )}
                    >
                      <p className="text-xs font-medium text-slate-500">{item.counterLabel}</p>
                      <p className="font-mono text-xl font-bold">{item.code}</p>
                      {item.staffName && <p className="truncate text-xs text-navy-soft">{item.staffName}</p>}
                    </div>
                  ))}
                </div>
              )}

              <h3 className="px-[18px] pt-1 pb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Up next
              </h3>
              {service.upNext.length === 0 ? (
                <p className="px-[18px] pb-3 text-sm text-slate-500">Queue is clear</p>
              ) : (
                <ol className="px-[18px]">
                  {service.upNext.map((row, index) => (
                    <li
                      key={row.code}
                      className="grid grid-cols-[30px_1fr_auto] items-center gap-2.5 border-t border-slate-100 py-2 text-sm first:border-t-0"
                    >
                      <span className="flex size-[26px] items-center justify-center rounded-lg bg-canvas text-xs font-semibold text-navy-soft tabular-nums">
                        {index + 1}
                      </span>
                      <span className="font-mono text-[15px] font-bold">{row.code}</span>
                      <span className="text-right text-navy-soft tabular-nums">
                        {waitText(row.estimate)} min
                        <span className="block text-[11px] text-slate-500">estimated</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-slate-100 bg-[#fbfdfe] px-[18px] py-3.5">
            <p className="min-w-0 flex-[1_1_200px] text-[13px] text-slate-500">
              Order set by staff. Waits are estimates and can change.
            </p>
            <span
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap text-brand-strong"
            >
              <Megaphone className="size-4" />
              {lastCall ? `${lastCall.code} called to ${lastCall.counterLabel}` : "Updates every 2 seconds"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
