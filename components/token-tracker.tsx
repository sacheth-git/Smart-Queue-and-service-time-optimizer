"use client";

import { ArrowRight, Check, Clock, TicketX, WifiOff, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { PublicTokenView } from "@/lib/queue/views";
import { cn } from "@/lib/utils";
import { postJson, usePoll } from "./use-poll";

const STEPS = ["Waiting", "Called", "With staff", "Done"];
const STEP_OF: Record<string, number> = { waiting: 0, called: 1, serving: 2, completed: 3 };

const FINAL_COPY: Record<string, string> = {
  completed: "Your visit is complete. Take care.",
  cancelled: "This token was cancelled.",
  no_show: "We called this token but could not find you. Please speak to reception.",
};

function Message({ title, body }: { title: string; body?: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-medium">{title}</p>
      {body && <p className="mt-1 text-sm text-muted-foreground">{body}</p>}
    </div>
  );
}

function WaitPanel({ view }: { view: PublicTokenView }) {
  if (view.isFinal) return <Message title={FINAL_COPY[view.status]} />;
  if (view.status === "called") return <Message title={`Please go to ${view.counterLabel} now`} />;
  if (view.status === "serving") return <Message title={`You are being seen at ${view.counterLabel}`} />;
  const estimate = view.estimate;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-muted-foreground">
        Position <span className="font-semibold text-foreground">{view.position}</span> in the queue
      </p>
      {estimate?.kind === "range" ? (
        <>
          <p className="flex items-center gap-2 text-2xl font-semibold">
            <Clock className="size-5 text-primary" />
            Estimated wait: {estimate.lowMin}–{estimate.highMin} min
          </p>
          <p className="text-sm text-muted-foreground">
            This is an estimate, not a set time. Urgent cases may be seen first, so it can change.
          </p>
        </>
      ) : (
        <p className="text-xl font-semibold">Waiting for a counter to open</p>
      )}
    </div>
  );
}

export function TokenTracker({ code }: { code: string }) {
  const { data, error, loading, notFound, refresh } = usePoll<PublicTokenView>(`/api/tokens/${code}`);
  const [confirming, setConfirming] = useState(false);

  if (notFound) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <TicketX className="size-10 text-muted-foreground" />
          <p className="text-lg font-medium">This token is no longer active</p>
          <Button render={<Link href="/check-in" />} nativeButton={false} variant="outline">
            <ArrowRight /> Check in again
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (loading || !data) {
    return <Card className="h-80 animate-pulse bg-muted" aria-label="Loading your token" />;
  }

  const current = STEP_OF[data.status];

  async function cancel() {
    const { error: failed } = await postJson(`/api/tokens/${code}/cancel`);
    setConfirming(false);
    if (failed) toast.error(failed);
    else toast.success("Your token was cancelled");
    void refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 py-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{data.serviceName}</p>
          <p className="font-mono text-6xl font-bold tracking-tight">{data.code}</p>
        </div>

        {current !== undefined && (
          <ol className="grid grid-cols-4 gap-1" aria-label="Progress">
            {STEPS.map((label, index) => (
              <li key={label} className="flex flex-col items-center gap-1 text-center text-xs">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border text-[11px] font-semibold",
                    index < current && "border-primary bg-primary text-primary-foreground",
                    index === current && "border-primary text-primary ring-3 ring-primary/20",
                    index > current && "text-muted-foreground",
                  )}
                >
                  {index < current ? <Check className="size-4" /> : index + 1}
                </span>
                <span className={cn(index !== current && "text-muted-foreground")}>{label}</span>
              </li>
            ))}
          </ol>
        )}

        <WaitPanel view={data} />

        {error && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <WifiOff className="size-4" /> Reconnecting...
          </p>
        )}

        {(data.status === "waiting" || data.status === "called") && (
          <Dialog open={confirming} onOpenChange={setConfirming}>
            <DialogTrigger render={<Button variant="ghost" className="text-muted-foreground" />}>
              <X /> Cancel my token
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel token {data.code}?</DialogTitle>
                <DialogDescription>You will lose your place in the queue.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Keep my token</DialogClose>
                <Button variant="destructive" onClick={cancel}>
                  <X /> Cancel token
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
