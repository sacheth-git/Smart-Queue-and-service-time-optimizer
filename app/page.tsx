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
      <section className="relative isolate grid items-center gap-10 py-6 lg:grid-cols-[1.02fr_1fr] lg:gap-14 lg:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[-30%] right-[-10%] -z-10 h-[640px] w-[640px] max-w-full rounded-full bg-[radial-gradient(closest-side,rgb(21_158_154/0.14),transparent_70%)]"
        />
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-mint py-1.5 pr-3 pl-2.5 text-[13px] font-semibold text-brand-strong">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-brand" />
            </span>
            Smart queue for outpatient departments
          </span>
          <h1 className="mt-5 text-[clamp(2.4rem,5.2vw,3.75rem)] leading-[1.04] font-bold tracking-[-0.035em] text-balance">
            <span className="block">Shorter queues.</span>
            <span className="block">Clearer waits.</span>
            <span className="block text-brand">Staff stay in charge.</span>
          </h1>
          <PulseLine />
          <Link
            href="/check-in"
            className="group mt-7 inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-brand px-6 text-base font-semibold text-white shadow-[0_10px_22px_-10px_rgb(21_158_154/0.9)] transition hover:-translate-y-px hover:bg-brand-strong active:translate-y-px active:scale-[0.98] sm:w-auto"
          >
            Get a token
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2.5 text-sm text-navy-soft">
            {PROMISES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2">
                <Icon className="size-4 text-brand" />
                {text}
              </li>
            ))}
          </ul>
          <p className="mt-7 flex max-w-[34em] items-center gap-2.5 rounded-xl bg-emergency-soft px-3.5 py-2.5 text-sm font-medium text-[#9b2c33]">
            <Siren className="size-4 shrink-0 text-emergency" />
            In an emergency, tell a staff member now. Do not wait for a token.
          </p>
        </div>

        <LiveQueuePreview />
      </section>

      <section aria-labelledby="roles-heading" className="pt-6 pb-10">
        <h2 id="roles-heading" className="mb-6 text-[26px] font-bold tracking-tight text-balance">
          One queue, four views
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map(({ href, icon: Icon, title, body }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-w-0 flex-col gap-2.5 rounded-[14px] border border-line bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#c9dce6] hover:shadow-md"
            >
              <span className="flex size-[42px] items-center justify-center rounded-xl bg-mint text-brand">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-1 text-[17px] font-semibold">{title}</h3>
              <p className="text-sm text-navy-soft">{body}</p>
              <span className="mt-auto flex items-center gap-1.5 pt-1.5 text-sm font-semibold text-brand-strong">
                Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
