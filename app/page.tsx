import {
  ArrowRight,
  ClipboardPlus,
  Clock,
  LayoutDashboard,
  MonitorPlay,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { tokenPathFromParam } from "@/lib/queue/track-link";

const ROLES = [
  {
    href: "/check-in",
    icon: ClipboardPlus,
    title: "Check-in",
    body: "Patients pick a service and get a digital token in under a minute.",
  },
  {
    href: "/display",
    icon: MonitorPlay,
    title: "Waiting room",
    body: "A public board showing who is being served and who is next.",
  },
  {
    href: "/staff",
    icon: Stethoscope,
    title: "Staff console",
    body: "Call patients, manage counters and review suggested priority.",
  },
  {
    href: "/admin",
    icon: LayoutDashboard,
    title: "Operations dashboard",
    body: "See peak hours and bottlenecks, and test staffing changes.",
  },
];

const PROMISES = [
  {
    icon: UserCheck,
    title: "Staff decide priority",
    body: "The system suggests and explains. A person confirms every decision, and it never replaces clinical judgement.",
  },
  {
    icon: Clock,
    title: "Honest estimates",
    body: "Waits are shown as ranges that update live. They are estimates, never promises.",
  },
  {
    icon: ShieldCheck,
    title: "Minimal personal data",
    body: "No names or medical notes. Public screens show token numbers only.",
  },
];

type HomeProps = { searchParams: Promise<{ token?: string | string[] }> };

export default async function HomePage({ searchParams }: HomeProps) {
  const tokenPath = tokenPathFromParam((await searchParams).token);
  if (tokenPath) redirect(tokenPath);

  return (
    <AppShell>
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 py-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Shorter queues. Clearer waits. Staff stay in charge.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          PulseQueue AI helps a hospital outpatient department issue tokens, estimate waits and put staff where
          they are needed most.
        </p>
        <Button render={<Link href="/check-in" />} nativeButton={false} size="lg">
          Start with check-in <ArrowRight />
        </Button>
      </section>

      <section aria-label="Screens" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map(({ href, icon: Icon, title, body }) => (
          <Link key={href} href={href} className="group rounded-xl focus-visible:ring-3 focus-visible:ring-ring">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <Icon className="size-6 text-primary" />
                <CardTitle>{title}</CardTitle>
                <CardDescription>{body}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>

      <section aria-label="Our principles" className="mt-8 grid gap-6 border-t pt-8 md:grid-cols-3">
        {PROMISES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3">
            <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
            <CardContent className="p-0">
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </CardContent>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
