"use client";

import { Clock, WifiOff } from "lucide-react";
import { DemoControls } from "@/components/demo-controls";
import { usePoll } from "@/components/use-poll";
import type { backtest, liveAccuracy } from "@/lib/analytics/backtest";
import type { Bottleneck } from "@/lib/analytics/bottlenecks";
import type { kpis } from "@/lib/analytics/kpis";
import type { HeatCell } from "@/lib/analytics/peaks";
import type { Recommendation } from "@/lib/analytics/recommendations";
import type { auditLog, serviceAnalytics } from "@/lib/analytics/service-stats";
import { AuditLog } from "./audit-log";
import { BottleneckAlerts, RecommendationCards } from "./bottleneck-alerts";
import { EstimatePanel } from "./estimate-panel";
import { KpiRow } from "./kpi-row";
import { PeakHeatmap } from "./peak-heatmap";
import { ServiceTable } from "./service-table";

type Live = {
  now: number;
  kpis: ReturnType<typeof kpis>;
  bottlenecks: Bottleneck[];
  recommendations: Recommendation[];
  services: ReturnType<typeof serviceAnalytics>;
  liveAccuracy: ReturnType<typeof liveAccuracy>;
  audit: ReturnType<typeof auditLog>;
};
type Analytics = { heatmap: HeatCell[]; backtest: ReturnType<typeof backtest> };

export function AdminDashboard() {
  const live = usePoll<Live>("/api/admin/live");
  const analytics = usePoll<Analytics>("/api/admin/analytics", 60_000);

  function refreshAll() {
    void live.refresh();
    void analytics.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operations dashboard</h1>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-4" />
            {live.data
              ? `Demo time ${new Date(live.data.now).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
              : "Loading..."}
          </p>
        </div>
        <DemoControls onChange={refreshAll} />
      </div>

      {live.error && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <WifiOff className="size-4" /> Reconnecting...
        </p>
      )}

      {!live.data ? (
        <div className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Loading the dashboard" />
      ) : (
        <>
          <KpiRow data={live.data.kpis} />
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <BottleneckAlerts items={live.data.bottlenecks} />
            <RecommendationCards items={live.data.recommendations} />
          </div>
          {analytics.data ? (
            <PeakHeatmap cells={analytics.data.heatmap} />
          ) : (
            <div className="h-72 animate-pulse rounded-xl bg-muted" aria-label="Loading peak hours" />
          )}
          <ServiceTable rows={live.data.services} />
          <EstimatePanel
            rows={live.data.services}
            sample={analytics.data?.backtest ?? null}
            live={live.data.liveAccuracy}
          />
          <AuditLog rows={live.data.audit} />
        </>
      )}
    </div>
  );
}
