import { ArrowRight, CircleCheck, DoorOpen, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { StatLabel } from "@/components/stat-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Bottleneck } from "@/lib/analytics/bottlenecks";
import type { Recommendation } from "@/lib/analytics/recommendations";

export function BottleneckAlerts({ items }: { items: Bottleneck[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bottlenecks right now</CardTitle>
        <CardDescription>Demand against capacity over the last 30 minutes.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {items.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheck className="size-4 text-emerald-700" /> All services are keeping up.
          </p>
        )}
        {items.map((item) => (
          <div key={item.serviceId} className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-medium">{item.message}</p>
              <p className="text-sm text-muted-foreground">
                {item.load === null ? "No counter open" : `Demand is ${Math.round(item.load * 100)}% of capacity`}
                {" · "}Longest wait {item.longestWait} min
              </p>
            </div>
          </div>
        ))}
        {items.length > 0 && (
          <div>
            <StatLabel kind="estimated" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RecommendationCards({ items }: { items: Recommendation[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommendations</CardTitle>
        <CardDescription>Suggested for staff to act on. Nothing changes automatically.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">No staffing changes would help right now.</p>
        )}
        {items.map((item) => (
          <div key={item.serviceId} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white shadow-sm p-3">
            <p className="font-medium">{item.title}</p>
            <p className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
              {item.currentAvgWait} min <ArrowRight className="size-5 text-primary" /> {item.projectedAvgWait} min
            </p>
            <p className="text-sm text-muted-foreground">Projected average wait from now. {item.basis}.</p>
            <div className="flex items-center justify-between gap-2">
              <StatLabel kind="simulated" />
              <Button render={<Link href="/staff" />} nativeButton={false} size="sm" variant="outline">
                <DoorOpen /> Open a counter
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
