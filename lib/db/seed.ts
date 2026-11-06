import { eq } from "drizzle-orm";
import { simulateQueue } from "@/lib/analytics/simulate";
import { setClock } from "@/lib/clock";
import type { Db } from "@/lib/db/client";
import { callNext } from "@/lib/queue/counters";
import { checkIn } from "@/lib/queue/check-in";
import { transition } from "@/lib/queue/transitions";
import { mulberry32, normal } from "@/lib/rng";
import {
  counters,
  historicalVisits,
  services,
  settings,
  tokenEvents,
  tokens,
  triageDecisions,
} from "./schema";

const MINUTE = 60_000;

const SERVICES = [
  { id: "general", name: "General OPD", prefix: "GEN", minutes: 10, total: 3, open: 3, daily: 100, today: 40, late: 6 },
  { id: "pediatrics", name: "Pediatrics", prefix: "PED", minutes: 12, total: 2, open: 2, daily: 45, today: 16, late: 4 },
  { id: "lab", name: "Lab", prefix: "LAB", minutes: 6, total: 3, open: 1, daily: 110, today: 33, late: 0 },
  { id: "pharmacy", name: "Pharmacy", prefix: "PHA", minutes: 4, total: 2, open: 2, daily: 120, today: 30, late: 4 },
];

/** Share of daily arrivals for each hour from 08:00 to 17:00. Lab history ran on two counters. */
const HOURLY_SHARE = [0.06, 0.14, 0.17, 0.16, 0.13, 0.09, 0.09, 0.08, 0.05, 0.03];
const HISTORY_COUNTERS: Record<string, number> = { general: 3, pediatrics: 2, lab: 2, pharmacy: 2 };

/** Made-up staff for the demo. Never real people. */
const STAFF: Record<string, string[]> = {
  general: ["Dr. Meera Rao", "Dr. Arjun Nair", "Dr. Kavita Shah"],
  pediatrics: ["Dr. Sanjay Iyer", "Dr. Neha Kulkarni"],
  lab: ["Anita Desai (Technician)", "Vikram Joshi (Technician)", "Pooja Reddy (Technician)"],
  pharmacy: ["Rohan Gupta (Pharmacist)", "Sneha Patil (Pharmacist)"],
};

const serviceMinutes = (rng: () => number, mean: number) =>
  Math.max(1.5, normal(rng, mean, 0.3 * mean));

export function seedServices(db: Db): void {
  db.insert(services)
    .values(SERVICES.map((s) => ({ id: s.id, name: s.name, prefix: s.prefix, defaultMinutes: s.minutes })))
    .run();
  db.insert(counters)
    .values(
      SERVICES.flatMap((s) =>
        Array.from({ length: s.total }, (_, i) => ({
          id: `${s.id}-${i + 1}`,
          serviceId: s.id,
          label: `Counter ${i + 1}`,
          staffName: STAFF[s.id][i] ?? null,
          isOpen: i < s.open ? 1 : 0,
        })),
      ),
    )
    .run();
}

export function seedHistory(db: Db, now: number): void {
  const rng = mulberry32(20261106);
  const rows: (typeof historicalVisits.$inferInsert)[] = [];

  for (let daysAgo = 30; daysAgo >= 1; daysAgo--) {
    const day = new Date(now);
    day.setDate(day.getDate() - daysAgo);
    day.setHours(0, 0, 0, 0);
    if (day.getDay() === 0) continue;

    for (const s of SERVICES) {
      // Some days run slower than others, and busy hours run slower than quiet ones.
      const dayPace = 0.85 + 0.35 * rng();
      const arrivals = HOURLY_SHARE.flatMap((share, h) => {
        const count = Math.round(s.daily * share * (0.85 + 0.3 * rng()));
        const hourPace = h >= 1 && h <= 4 ? 1.15 : 0.95;
        return Array.from({ length: count }, () => ({
          atMin: (8 + h) * 60 + rng() * 60,
          serviceMin: serviceMinutes(rng, s.minutes * dayPace * hourPace),
        }));
      }).sort((a, b) => a.atMin - b.atMin);

      const visits = simulateQueue(arrivals, HISTORY_COUNTERS[s.id]);
      arrivals.forEach((a, i) => {
        const at = (m: number) => day.getTime() + Math.round(m * MINUTE);
        rows.push({
          serviceId: s.id,
          arrivedAt: at(a.atMin),
          startedAt: at(visits[i].startMin),
          completedAt: at(visits[i].startMin + a.serviceMin),
          weekday: day.getDay(),
          hour: Math.floor(a.atMin / 60),
          waitMin: visits[i].waitMin,
          serviceMin: a.serviceMin,
          countersOpen: HISTORY_COUNTERS[s.id],
        });
      });
    }
  }
  for (let i = 0; i < rows.length; i += 200) {
    db.insert(historicalVisits).values(rows.slice(i, i + 200)).run();
  }
}

type SeedStep = { at: number; order: number; run: () => void };

/** Plays this morning forward through the real check-in and state machine code. */
export function seedToday(db: Db, now: number): void {
  const rng = mulberry32(11);
  const opening = new Date(now);
  opening.setHours(8, 0, 0, 0);
  const windowMin = (now - opening.getTime()) / MINUTE;
  const steps: SeedStep[] = [];
  let person = 0;

  const addPatient = (serviceId: string, at: number, itemCodes: string[] = []) => {
    person += 1;
    const n = person;
    let id = "";
    steps.push({
      at,
      order: 1,
      run: () => {
        id = checkIn(db, {
          serviceId,
          phone: `90${String(n).padStart(8, "0")}`,
          itemCodes,
          idempotencyKey: `seed-${n}`,
          now: at,
        }).token.id;
      },
    });
    return () => id;
  };

  for (const s of SERVICES) {
    const arrivals = Array.from({ length: s.today }, () => ({
      atMin: rng() * (windowMin - 20),
      serviceMin: serviceMinutes(rng, s.minutes),
    })).sort((a, b) => a.atMin - b.atMin);
    const visits = simulateQueue(arrivals, s.open);
    const free = Array.from({ length: s.open }, (_, i) => `${s.id}-${i + 1}`);

    arrivals.forEach((a, i) => {
      const arrived = opening.getTime() + Math.round(a.atMin * MINUTE);
      const start = opening.getTime() + Math.round(visits[i].startMin * MINUTE);
      const end = opening.getTime() + Math.round((visits[i].startMin + a.serviceMin) * MINUTE);
      const tokenId = addPatient(s.id, arrived);
      const fate = rng();

      if (fate < 0.03 && arrived + 3 * MINUTE < Math.min(start, now)) {
        steps.push({
          at: arrived + 3 * MINUTE,
          order: 2,
          run: () => void transition(db, tokenId(), "cancelled", { now: arrived + 3 * MINUTE, actor: "patient" }),
        });
        return;
      }
      if (start >= now) return;

      let counterId = "";
      steps.push({
        at: start,
        order: 2,
        run: () => {
          counterId = free.shift()!;
          transition(db, tokenId(), "called", { now: start, actor: "seed", counterId });
          if (fate >= 0.08) transition(db, tokenId(), "serving", { now: start, actor: "seed" });
        },
      });
      const noShow = fate < 0.08;
      const closesAt = noShow ? start + 2 * MINUTE : end;
      if (closesAt < now) {
        steps.push({
          at: closesAt,
          order: 0,
          run: () => {
            transition(db, tokenId(), noShow ? "no_show" : "completed", { now: closesAt, actor: "seed" });
            free.push(counterId);
          },
        });
      }
    });

    for (let i = 0; i < s.late; i++) {
      const itemCodes =
        i === s.late - 1 && s.id === "general" ? ["high_fever"] : i === s.late - 1 && s.id === "pediatrics" ? ["under_2"] : [];
      addPatient(s.id, now - (16 - i) * MINUTE, itemCodes);
    }
  }

  steps.sort((a, b) => a.at - b.at || a.order - b.order);
  for (const step of steps) step.run();

  for (const counter of db.select().from(counters).where(eq(counters.isOpen, 1)).all()) {
    const held = db.select().from(tokens).where(eq(tokens.counterId, counter.id)).get();
    if (held) continue;
    const next = callNext(db, counter.id, now, "seed");
    if (next) transition(db, next.id, "serving", { now, actor: "seed" });
  }
}

function demoMorning(realNow: number): number {
  const d = new Date(realNow);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
  d.setHours(11, 0, 0, 0);
  return d.getTime();
}

export function resetDemo(db: Db, realNow = Date.now()): void {
  const now = demoMorning(realNow);
  db.transaction(() => {
    for (const table of [tokenEvents, triageDecisions, tokens, historicalVisits, counters, services, settings]) {
      db.delete(table).run();
    }
    seedServices(db);
    seedHistory(db, now);
    seedToday(db, now);
    setClock(db, now, realNow);
  });
}
