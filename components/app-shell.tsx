"use client";

import { Activity, ClipboardPlus, LayoutDashboard, MonitorPlay, Stethoscope } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/check-in", label: "Check-in", icon: ClipboardPlus },
  { href: "/display", label: "Waiting Room", icon: MonitorPlay },
  { href: "/staff", label: "Staff", icon: Stethoscope },
  { href: "/admin", label: "Admin", icon: LayoutDashboard },
];

/** The bar turns to frosted glass once the page scrolls under it. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return scrolled;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const scrolled = useScrolled();

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-canvas text-navy">
      <header
        className={cn(
          "sticky top-0 z-30 border-b transition-[background-color,border-color,box-shadow] duration-300",
          scrolled
            ? "border-line bg-white/75 shadow-sm backdrop-blur-md backdrop-saturate-150"
            : "border-transparent bg-white",
        )}
      >
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 md:flex-nowrap">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <span className="relative flex size-9 items-center justify-center rounded-lg bg-brand text-white">
              <Activity className="size-5" />
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-white bg-emerald-400"
              />
            </span>
            <span>
              PulseQueue <span className="font-normal text-navy-soft">AI</span>
            </span>
          </Link>
          <nav
            aria-label="Main"
            className="order-3 flex w-full justify-between gap-1 [scrollbar-width:none] max-sm:overflow-x-auto sm:justify-start md:order-none md:w-auto [&::-webkit-scrollbar]:hidden"
          >
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                    active ? "bg-mint text-brand-strong" : "text-navy-soft hover:bg-slate-100 hover:text-navy",
                  )}
                >
                  <Icon className="size-4 max-sm:hidden" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <span className="ml-auto hidden text-sm text-navy-soft sm:inline">Demo mode, synthetic data</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
