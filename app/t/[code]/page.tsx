import { AppShell } from "@/components/app-shell";
import { TokenTracker } from "@/components/token-tracker";

export default async function TokenPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-md">
        <TokenTracker code={code} />
      </div>
    </AppShell>
  );
}
