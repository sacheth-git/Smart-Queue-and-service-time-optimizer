import { Flag, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StaffQueueRow, StaffService } from "@/lib/queue/views";
import { CounterCard, type CounterActions } from "./counter-card";
import { PriorityBadge } from "./priority-badge";

export function ServiceQueue({
  service,
  act,
  onSetPriority,
}: {
  service: StaffService;
  act: CounterActions;
  onSetPriority: (row: StaffQueueRow) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {service.counters.map((counter) => (
          <CounterCard key={counter.id} counter={counter} act={act} />
        ))}
      </div>

      {service.queue.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-muted-foreground">
          Nobody is waiting for {service.name}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Waited</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {service.queue.map((row, index) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="font-mono font-semibold">{row.code}</TableCell>
                  <TableCell>{row.waitedMin} min</TableCell>
                  <TableCell>
                    <PriorityBadge level={row.confirmedPriority} />
                  </TableCell>
                  <TableCell>
                    {row.needsWaitReview && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800">
                        <TriangleAlert className="size-3" /> Waited 45+ min, review
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => onSetPriority(row)}>
                      <Flag /> Set priority
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => act.token(row.id, "cancel")}>
                      <X /> Cancel
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
