import {
  ArrowRight,
  ClipboardPlus,
  Clock,
  LayoutDashboard,
  Lock,
  MonitorPlay,
  ShieldCheck,
  Siren,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { LiveQueuePreview } from "@/components/home/live-queue-preview";
import { PulseLine } from "@/components/home/pulse-line";
import { tokenPathFromParam } from "@/lib/queue/track-link";

const ROLES = [
  {
    href: "/check-in",
    icon: ClipboardPlus,
    title: "Check-in",
    body: "Patients pick a service and get a token in under a minute.",
  },
  {
    href: "/display",
    icon: MonitorPlay,
    title: "Waiting Room",
    body: "A public board, with spoken calls in English, Kannada and Hindi.",
  },
  {
    href: "/staff",
    icon: Stethoscope,
    title: "Staff",
    body: "Call patients, run counters and confirm priority.",
  },
  {
    href: "/admin",
    icon: LayoutDashboard,
    title: "Admin",
    body: "See peaks and bottlenecks, and add counters when needed.",
  },
];

const PROMISES = [
  { icon: ShieldCheck, text: "Staff confirm every priority" },
  { icon: Clock, text: "Waits shown as ranges" },
  { icon: Lock, text: "No patient names stored" },
];

type HomeProps = { searchParams: Promise<{ token?: string | string[] }> };

export default async function HomePage({ searchParams }: HomeProps) {
  const tokenPath = tokenPathFromParam((await searchParams).token);
  if (tokenPath) redirect(tokenPath);

  return (
    <AppShell>
      <section className="grid items-center gap-10 py-6 lg:grid-cols-[1fr_1fr] lg:gap-16 lg:py-12">
        <div className="min-w-0">
          <p className="text-sm font-medium text-navy-soft">For hospital outpatient departments</p>
          <h1 className="mt-4 text-[clamp(2.4rem,5.2vw,3.75rem)] leading-[1.04] font-medium tracking-[-0.03em] text-balance">
            <span className="block">Shorter queues.</span>
            <span className="block">Clearer waits.</span>
            <span className="block text-brand">Staff stay in charge.</span>
          </h1>
          <PulseLine />
          <Link
            href="/check-in"
            className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-6 text-base font-medium text-white shadow-sm transition-[background-color,transform] duration-150 hover:bg-brand-strong active:scale-[0.98] sm:w-auto"
          >
            Get a token
            <ArrowRight className="size-[18px]" />
          </Link>
          <p className="mt-6 flex max-w-[34rem] items-center gap-2 rounded-lg bg-emergency-soft px-4 py-3 text-sm font-medium text-[#9b2c33]">
            <Siren className="size-4 shrink-0 text-emergency" />
            In an emergency, tell a staff member now. Do not wait for a token.
          </p>
        </div>

        <LiveQueuePreview />
      </section>

      <section aria-labelledby="roles-heading" className="pt-8 pb-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h2 id="roles-heading" className="text-2xl font-medium tracking-tight text-balance">
            One queue, four views
          </h2>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-soft">
            {PROMISES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2">
                <Icon className="size-4" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map(({ href, icon: Icon, title, body }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-white p-5 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50/60"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-canvas text-navy-soft">
                <Icon className="size-[18px]" />
              </span>
              <h3 className="mt-2 text-base font-semibold">{title}</h3>
              <p className="text-sm text-navy-soft">{body}</p>
              <span className="mt-auto flex items-center gap-1 pt-2 text-sm font-medium text-navy group-hover:text-brand-strong">
                Open <ArrowRight className="size-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
