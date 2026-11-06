"use client";

import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postJson } from "@/components/use-poll";
import type { serviceAnalytics } from "@/lib/analytics/service-stats";

type Props = { services: ReturnType<typeof serviceAnalytics>; onAdded: () => void };

export function AddCounter({ services, onAdded }: Props) {
  const [picked, setPicked] = useState("");
  const [staffName, setStaffName] = useState("");
  const [saving, setSaving] = useState(false);
  const serviceId = picked || services[0]?.serviceId || "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const { data, error } = await postJson("/api/admin/counters", { serviceId, staffName });
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    const serviceName = services.find((s) => s.serviceId === serviceId)?.serviceName;
    toast.success(`${(data as { label: string }).label} is open in ${serviceName}`);
    setStaffName("");
    onAdded();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a counter</CardTitle>
        <CardDescription>
          When a new doctor or staff member arrives, open a counter for them. It appears on the staff console
          right away.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5 sm:w-56">
            <Label htmlFor="add-counter-service">Service</Label>
            <select
              id="add-counter-service"
              value={serviceId}
              onChange={(event) => setPicked(event.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {services.map((service) => (
                <option key={service.serviceId} value={service.serviceId}>
                  {service.serviceName} ({service.openCounters} open)
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="add-counter-name">Doctor or staff name</Label>
            <Input
              id="add-counter-name"
              value={staffName}
              onChange={(event) => setStaffName(event.target.value)}
              placeholder="Dr. Sample Name"
              maxLength={60}
              required
            />
          </div>
          <Button type="submit" disabled={saving || !staffName.trim()}>
            <Plus /> {saving ? "Adding..." : "Add counter"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
