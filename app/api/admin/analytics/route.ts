import { backtest } from "@/lib/analytics/backtest";
import { peakHeatmap } from "@/lib/analytics/peaks";
import { handle } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

export const GET = handle((_params, db) => ({ heatmap: peakHeatmap(db), backtest: backtest(db) }));
