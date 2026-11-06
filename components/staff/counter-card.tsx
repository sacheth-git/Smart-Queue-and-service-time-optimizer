"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { StaffCounter } from "@/lib/queue/views";
import { cn } from "@/lib/utils";

export type CounterActions = {
  counter: (id: string, action: "open" | "close" | "call_next") => void;
  token: (id: string, action: string, endedEarly?: boolean) => void;
};

export function CounterCard({ counter, act }: { counter: StaffCounter; act: CounterActions }) {
  const [endedEarly, setEndedEarly] = useState(false);
  const token = counter.token;

  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border bg-card p-3", !counter.isOpen && "bg-muted/50")}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{counter.label}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            counter.isOpen ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground",
          )}
        >
          {counter.isOpen ? "Open" : "Closed"}
        </span>
      </div>

      {token ? (
        <p className="font-mono text-2xl font-bold">
          {token.code}
          <span className="ml-2 font-sans text-xs font-medium text-muted-foreground">
            {token.status === "called" ? "Called" : "With staff"}
          </span>
        </p>
      ) : (
        <p className="py-1 text-sm text-muted-foreground">{counter.isOpen ? "Free" : "Not in use"}</p>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        {!counter.isOpen && (
          <Button size="sm" variant="outline" onClick={() => act.counter(counter.id, "open")}>
            Open counter
          </Button>
        )}
        {counter.isOpen && !token && (
          <>
            <Button size="sm" onClick={() => act.counter(counter.id, "call_next")}>
              Call next
            </Button>
            <Button size="sm" variant="ghost" onClick={() => act.counter(counter.id, "close")}>
              Close
            </Button>
          </>
        )}
        {token?.status === "called" && (
          <>
            <Button size="sm" onClick={() => act.token(token.id, "start")}>
              Start
            </Button>
            <Button size="sm" variant="outline" onClick={() => act.token(token.id, "no_show")}>
              No-show
            </Button>
            <Button size="sm" variant="outline" onClick={() => act.token(token.id, "recall")}>
              Recall
            </Button>
            <Button size="sm" variant="ghost" onClick={() => act.token(token.id, "cancel")}>
              Cancel
            </Button>
          </>
        )}
        {token?.status === "serving" && (
          <>
            <Button
              size="sm"
              onClick={() => {
                act.token(token.id, "complete", endedEarly);
                setEndedEarly(false);
              }}
            >
              Complete
            </Button>
            <Label className="flex items-center gap-1.5 text-xs font-normal">
              <Checkbox checked={endedEarly} onCheckedChange={(on) => setEndedEarly(on === true)} />
              Ended early
            </Label>
          </>
        )}
      </div>
    </div>
  );
}
