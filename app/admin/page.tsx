import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AppShell } from "@/components/app-shell";

export default function AdminPage() {
  return (
    <AppShell>
      <AdminDashboard />
    </AppShell>
  );
}
