import type { Db } from "@/lib/db/client";
import { tokens } from "@/lib/db/schema";
import { meanOf } from "@/lib/estimate/wait";

const MINUTE = 60_000;

export function kpis(db: Db, now: number) {
  const all = db.select().from(tokens).all();
  const waiting = all.filter((t) => t.status === "waiting");
  const started = all.filter((t) => t.startedAt !== null);
  const noShows = all.filter((t) => t.status === "no_show").length;
  const served = all.filter((t) => t.status === "completed").length;
  const closed = noShows + served + all.filter((t) => t.status === "cancelled").length;

  return {
    waitingNow: waiting.length,
    avgWaitToday: started.length
      ? Math.round(meanOf(started.map((t) => (t.startedAt! - t.checkedInAt) / MINUTE)) * 10) / 10
      : 0,
    longestWait: Math.round(Math.max(0, ...waiting.map((t) => (now - t.checkedInAt) / MINUTE))),
    served,
    noShowRate: closed ? noShows / closed : 0,
  };
}
