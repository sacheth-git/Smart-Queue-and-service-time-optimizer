import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/types";

const STYLES: Record<Priority, { label: string; tone: string }> = {
  urgent: { label: "Critical", tone: "border-red-200 bg-red-100 font-semibold text-red-700" },
  priority: { label: "Urgent", tone: "border-amber-200 bg-amber-100 text-amber-700" },
  routine: { label: "Routine", tone: "border-blue-200 bg-blue-100 text-blue-700" },
};

export const priorityLabel = (p: Priority) => STYLES[p].label;

export function PriorityBadge({ level }: { level: Priority }) {
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", STYLES[level].tone)}>
      {STYLES[level].label}
    </span>
  );
}
