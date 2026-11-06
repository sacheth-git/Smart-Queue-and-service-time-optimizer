import { AppShell } from "@/components/app-shell";
import { StaffConsole } from "@/components/staff/staff-console";
import { OVERRIDE_REASONS } from "@/lib/triage/decide";

export default function StaffPage() {
  return (
    <AppShell>
      <StaffConsole overrideReasons={OVERRIDE_REASONS} />
    </AppShell>
  );
}
