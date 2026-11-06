import { liveAccuracy } from "@/lib/analytics/backtest";
import { detectBottlenecks } from "@/lib/analytics/bottlenecks";
import { kpis } from "@/lib/analytics/kpis";
import { recommendations } from "@/lib/analytics/recommendations";
import { auditLog, serviceAnalytics } from "@/lib/analytics/service-stats";
import { handle } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

export const GET = handle((_params, db, now) => ({
  now,
  kpis: kpis(db, now),
  bottlenecks: detectBottlenecks(db, now),
  recommendations: recommendations(db, now),
  services: serviceAnalytics(db, now),
  liveAccuracy: liveAccuracy(db),
  audit: auditLog(db),
}));
