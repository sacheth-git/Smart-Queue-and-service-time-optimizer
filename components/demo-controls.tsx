"use client";

import { FastForward, RotateCcw, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { postJson } from "./use-poll";

export function DemoControls({ onChange }: { onChange?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function run(url: string, success: string, body?: unknown) {
    setBusy(true);
    const { error } = await postJson(url, body);
    setBusy(false);
    setConfirming(false);
    if (error) toast.error(error);
    else toast.success(success);
    onChange?.();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 shadow-sm">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Demo controls</span>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => run("/api/demo/rush", "15 patients arrived at the Lab")}
      >
        <Users /> Simulate rush
      </Button>
      {[5, 15, 30].map((minutes) => (
        <Button
          key={minutes}
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => run("/api/demo/advance", `Moved ahead ${minutes} minutes`, { minutes })}
        >
          <FastForward /> {minutes} min
        </Button>
      ))}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogTrigger render={<Button size="sm" variant="ghost" disabled={busy} />}>
          <RotateCcw /> Reset demo
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the demo?</DialogTitle>
            <DialogDescription>
              This clears everything done so far and restores the 11:00 morning queue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Keep going</DialogClose>
            <Button disabled={busy} onClick={() => run("/api/demo/reset", "Demo reset")}>
              <RotateCcw /> Reset demo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
