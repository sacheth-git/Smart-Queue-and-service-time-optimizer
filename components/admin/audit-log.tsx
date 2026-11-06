import { PriorityBadge } from "@/components/staff/priority-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { auditLog } from "@/lib/analytics/service-stats";

export function AuditLog({ rows }: { rows: ReturnType<typeof auditLog> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Triage audit log</CardTitle>
        <CardDescription>Every priority decision, made and confirmed by staff.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No decisions yet. They appear here as staff make them.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Suggested</TableHead>
                  <TableHead>Reasons</TableHead>
                  <TableHead>Staff decision</TableHead>
                  <TableHead>Reason for change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="tabular-nums">
                      {new Date(row.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="font-mono font-semibold">{row.tokenCode}</TableCell>
                    <TableCell>{row.suggested ? <PriorityBadge level={row.suggested} /> : "None"}</TableCell>
                    <TableCell>{row.reasons.join(", ") || "None"}</TableCell>
                    <TableCell>
                      <PriorityBadge level={row.decision} />
                    </TableCell>
                    <TableCell>{row.overrideReason ?? "None"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
