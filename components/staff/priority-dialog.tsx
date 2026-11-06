"use client";

import { ArrowLeft, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StaffQueueRow } from "@/lib/queue/views";
import type { Priority } from "@/lib/types";
import { cn } from "@/lib/utils";
import { priorityLabel } from "./priority-badge";

const LEVELS: Priority[] = ["urgent", "priority", "routine"];

function Choice({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-colors hover:bg-muted",
        on && "border-primary bg-accent font-medium text-accent-foreground",
      )}
    >
      {label}
    </button>
  );
}

export function PriorityDialog({
  row,
  reasons,
  onClose,
  onSave,
}: {
  row: StaffQueueRow;
  reasons: readonly string[];
  onClose: () => void;
  onSave: (decision: Priority, overrideReason?: string) => void;
}) {
  const [level, setLevel] = useState<Priority>(row.confirmedPriority);
  const [reason, setReason] = useState<string | null>(null);
  const needsReason = row.suggestedPriority !== null && row.suggestedPriority !== level;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set priority for {row.code}</DialogTitle>
          <DialogDescription>
            {row.suggestedPriority
              ? `Suggested for staff review: ${priorityLabel(row.suggestedPriority)}. You make the decision.`
              : "There is no suggestion for this patient. You make the decision."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            {LEVELS.map((l) => (
              <Choice key={l} on={level === l} label={priorityLabel(l)} onClick={() => setLevel(l)} />
            ))}
          </div>
          {needsReason && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Why are you changing the suggested level?</p>
              <div className="grid grid-cols-2 gap-2">
                {reasons.map((r) => (
                  <Choice key={r} on={reason === r} label={r} onClick={() => setReason(r)} />
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <ArrowLeft /> Back
          </Button>
          <Button
            disabled={needsReason && !reason}
            onClick={() => onSave(level, needsReason ? (reason ?? undefined) : undefined)}
          >
            <Check /> Save decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
