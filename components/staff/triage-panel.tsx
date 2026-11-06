import { Check, Pencil, ShieldCheck, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StaffQueueRow } from "@/lib/queue/views";
import type { Priority } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PriorityBadge, priorityLabel } from "./priority-badge";

export function TriagePanel({
  rows,
  onConfirm,
  onChange,
}: {
  rows: StaffQueueRow[];
  onConfirm: (row: StaffQueueRow, decision: Priority) => void;
  onChange: (row: StaffQueueRow) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" /> Triage review
          {rows.length > 0 && (
            <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{rows.length}</span>
          )}
        </CardTitle>
        <CardDescription>
          Illustrative rules, not clinically validated. Staff make the decision.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing to review right now.</p>}
        {rows.map((row) => {
          const level = row.suggestedPriority!;
          const urgent = level === "urgent";
          return (
            <div
              key={row.id}
              className={cn("flex flex-col gap-2 rounded-xl border border-slate-200 bg-white shadow-sm p-3", urgent && "border-red-200 bg-red-50")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-mono text-lg font-bold">
                  {urgent && <Siren className="size-4 animate-pulse text-red-600" />}
                  {row.code}
                </span>
                <PriorityBadge level={level} />
              </div>
              <p className="text-xs text-muted-foreground">Suggested for staff review</p>
              <p className="text-sm">{row.reasons.join(", ")}</p>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => onConfirm(row, level)}>
                  <Check /> Confirm {priorityLabel(level)}
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => onChange(row)}>
                  <Pencil /> Change level
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
