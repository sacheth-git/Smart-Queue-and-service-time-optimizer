import { Calculator, Database, FlaskConical, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

const LABELS = {
  measured: { text: "Measured in demo", icon: Gauge, tone: "bg-emerald-50 text-emerald-800" },
  simulated: { text: "Simulated", icon: FlaskConical, tone: "bg-violet-50 text-violet-800" },
  sample: { text: "Sample data", icon: Database, tone: "bg-sky-50 text-sky-800" },
  estimated: { text: "Estimated", icon: Calculator, tone: "bg-amber-50 text-amber-800" },
} as const;

export function StatLabel({ kind }: { kind: keyof typeof LABELS }) {
  const { text, icon: Icon, tone } = LABELS[kind];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tone)}>
      <Icon className="size-3" />
      {text}
    </span>
  );
}
