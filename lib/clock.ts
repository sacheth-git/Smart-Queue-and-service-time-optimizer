import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";

export function getSetting(db: Db, key: string): string | null {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

export function setSetting(db: Db, key: string, value: string): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export function setClock(db: Db, demoMs: number, realNow = Date.now()): void {
  setSetting(db, "clock_demo_ms", String(demoMs));
  setSetting(db, "clock_real_ms", String(realNow));
}

/** The one place that reads real time. Everything else takes `now` as an argument. */
export function demoNow(db: Db, realNow = Date.now()): number {
  const demo = getSetting(db, "clock_demo_ms");
  const real = getSetting(db, "clock_real_ms");
  if (demo === null || real === null) return realNow;
  return Number(demo) + (realNow - Number(real));
}
