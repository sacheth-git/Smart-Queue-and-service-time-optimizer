"use client";

import { WifiOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DemoControls } from "@/components/demo-controls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { postJson, usePoll } from "@/components/use-poll";
import type { StaffQueueRow, StaffView } from "@/lib/queue/views";
import type { Priority } from "@/lib/types";
import type { CounterActions } from "./counter-card";
import { PriorityDialog } from "./priority-dialog";
import { ServiceQueue } from "./service-queue";
import { TriagePanel } from "./triage-panel";

export function StaffConsole({ overrideReasons }: { overrideReasons: readonly string[] }) {
  const { data, error, refresh } = usePoll<StaffView>("/api/staff/queue");
  const [editing, setEditing] = useState<StaffQueueRow | null>(null);
  const [tab, setTab] = useState("general");

  async function send(url: string, body: unknown, success?: string) {
    const { error: failed, data: result } = await postJson(url, body);
    if (failed) toast.error(failed);
    else if (success) toast.success(success);
    await refresh();
    return result as { called?: string | null } | undefined;
  }

  const act: CounterActions = {
    counter: async (id, action) => {
      const result = await send(`/api/staff/counters/${id}`, { action });
      if (action === "call_next" && result && result.called === null) toast.info("Nobody is waiting.");
    },
    token: (id, action, endedEarly) => send(`/api/staff/tokens/${id}/action`, { action, endedEarly }),
  };

  async function decide(row: StaffQueueRow, decision: Priority, overrideReason?: string) {
    setEditing(null);
    await send(`/api/staff/tokens/${row.id}/triage`, { decision, overrideReason }, `${row.code} updated`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Staff console</h1>
          <p className="text-muted-foreground">Call patients, manage counters and review priority.</p>
        </div>
        <DemoControls onChange={refresh} />
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <WifiOff className="size-4" /> Reconnecting...
        </p>
      )}

      {!data ? (
        <div className="h-96 animate-pulse rounded-xl bg-muted" aria-label="Loading the queue" />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_340px]">
          <Tabs value={tab} onValueChange={setTab} className="min-w-0">
            <TabsList>
              {data.services.map((service) => (
                <TabsTrigger key={service.id} value={service.id}>
                  {service.name}
                  <span className="ml-1 text-xs text-muted-foreground">{service.queue.length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {data.services.map((service) => (
              <TabsContent key={service.id} value={service.id} className="pt-3">
                <ServiceQueue service={service} act={act} onSetPriority={setEditing} />
              </TabsContent>
            ))}
          </Tabs>
          <TriagePanel rows={data.pendingReview} onConfirm={decide} onChange={setEditing} />
        </div>
      )}

      {editing && (
        <PriorityDialog
          key={editing.id}
          row={editing}
          reasons={overrideReasons}
          onClose={() => setEditing(null)}
          onSave={(decision, reason) => decide(editing, decision, reason)}
        />
      )}
    </div>
  );
}
