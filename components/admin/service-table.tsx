import { StatLabel } from "@/components/stat-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { serviceAnalytics } from "@/lib/analytics/service-stats";

export function ServiceTable({ rows }: { rows: ReturnType<typeof serviceAnalytics> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Service analytics</CardTitle>
        <CardDescription>How each service has performed today.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Waiting</TableHead>
                <TableHead className="text-right">Open counters</TableHead>
                <TableHead className="text-right">Served</TableHead>
                <TableHead className="text-right">Avg wait</TableHead>
                <TableHead className="text-right">Avg visit</TableHead>
                <TableHead className="text-right">No-shows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.serviceId}>
                  <TableCell className="font-medium">{row.serviceName}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.waiting}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.openCounters}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.served}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.avgWait} min</TableCell>
                  <TableCell className="text-right tabular-nums">{row.avgService} min</TableCell>
                  <TableCell className="text-right tabular-nums">{Math.round(row.noShowRate * 100)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div>
          <StatLabel kind="measured" />
        </div>
      </CardContent>
    </Card>
  );
}
