import { networkInterfaces } from "node:os";
import { AppShell } from "@/components/app-shell";
import { CheckInForm } from "@/components/check-in-form";
import { getDb } from "@/lib/db/client";
import { services } from "@/lib/db/schema";
import { pickNetworkAddress } from "@/lib/network-address";
import { ITEMS } from "@/lib/triage/rules";

export const dynamic = "force-dynamic";

export default function CheckInPage() {
  const list = getDb().select({ id: services.id, name: services.name }).from(services).all();
  return (
    <AppShell>
      <div className="mt-4 mb-6 text-center">
        <h1 className="text-[clamp(1.9rem,4vw,2.5rem)] leading-tight font-bold tracking-[-0.03em] text-balance">
          Get your token
        </h1>
        <p className="mt-2 text-[17px] text-navy-soft">Join the queue in under a minute.</p>
      </div>
      <CheckInForm
        services={list}
        items={ITEMS.map(({ code, label }) => ({ code, label }))}
        networkAddress={pickNetworkAddress(networkInterfaces())}
      />
    </AppShell>
  );
}
