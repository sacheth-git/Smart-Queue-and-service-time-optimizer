import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/types";

const STYLES: Record<Priority, { label: string; tone: string }> = {
  urgent: { label: "Urgent", tone: "bg-red-100 text-red-800" },
  priority: { label: "Priority", tone: "bg-amber-100 text-amber-900" },
  routine: { label: "Routine", tone: "bg-muted text-muted-foreground" },
};

export const priorityLabel = (p: Priority) => STYLES[p].label;

export function PriorityBadge({ level }: { level: Priority }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STYLES[level].tone)}>
      {STYLES[level].label}
    </span>
  );
}
