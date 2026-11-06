import { AppShell } from "@/components/app-shell";
import { CheckInForm } from "@/components/check-in-form";
import { getDb } from "@/lib/db/client";
import { services } from "@/lib/db/schema";
import { ITEMS } from "@/lib/triage/rules";

export const dynamic = "force-dynamic";

export default function CheckInPage() {
  const list = getDb().select({ id: services.id, name: services.name }).from(services).all();
  return (
    <AppShell>
      <div className="mb-5 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Get your token</h1>
        <p className="text-muted-foreground">Join the queue in under a minute.</p>
      </div>
      <CheckInForm services={list} items={ITEMS.map(({ code, label }) => ({ code, label }))} />
    </AppShell>
  );
}
