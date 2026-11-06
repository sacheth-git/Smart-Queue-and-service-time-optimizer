import { StatLabel } from "@/components/stat-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { backtest, liveAccuracy } from "@/lib/analytics/backtest";
import type { serviceAnalytics } from "@/lib/analytics/service-stats";

export function EstimatePanel({
  rows,
  sample,
  live,
}: {
  rows: ReturnType<typeof serviceAnalytics>;
  sample: ReturnType<typeof backtest> | null;
  live: ReturnType<typeof liveAccuracy>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How wait estimates work</CardTitle>
        <CardDescription>
          People ahead × average visit ÷ open counters, shown as a range. The average blends sample history with
          today, trusting today more as visits finish.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Average error, replaying the last 7 sample days</p>
            {sample ? (
              <>
                <p className="text-2xl font-semibold tabular-nums">{sample.modelMae} min</p>
                <p className="text-sm text-muted-foreground">
                  Fixed-time estimate: {sample.baselineMae} min, over {sample.samples.toLocaleString("en-IN")} visits
                </p>
              </>
            ) : (
              <p className="h-14 animate-pulse rounded bg-muted" />
            )}
            <div>
              <StatLabel kind="sample" />
            </div>
          </div>
          <div className="flex flex-col gap-1 rounded-lg border p-3">
            <p className="text-sm text-muted-foreground">Average error, this session</p>
            <p className="text-2xl font-semibold tabular-nums">{live ? `${live.mae} min` : "No visits yet"}</p>
            <p className="text-sm text-muted-foreground">
              {live ? `Over ${live.samples} visits. Includes generated demo activity.` : "Includes generated demo activity."}
            </p>
            <div>
              <StatLabel kind="measured" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Current inputs</TableHead>
                <TableHead className="text-right">Average visit</TableHead>
                <TableHead className="text-right">Spread</TableHead>
                <TableHead className="text-right">Visits today</TableHead>
                <TableHead className="text-right">Weight on today</TableHead>
                <TableHead className="text-right">Sample median</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.serviceId}>
                  <TableCell className="font-medium">{row.serviceName}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.estimateInputs.mean} min</TableCell>
                  <TableCell className="text-right tabular-nums">±{row.estimateInputs.sd} min</TableCell>
                  <TableCell className="text-right tabular-nums">{row.estimateInputs.todayCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.estimateInputs.todayWeight}%</TableCell>
                  <TableCell className="text-right tabular-nums">{row.estimateInputs.historicalMedian} min</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
