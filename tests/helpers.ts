import { randomUUID } from "node:crypto";
import { createDb, type Db } from "@/lib/db/client";
import { counters, services, tokens } from "@/lib/db/schema";
import type { TokenStatus } from "@/lib/types";

/** 2026-11-03 11:00 IST, a Tuesday. */
export const T0 = Date.UTC(2026, 10, 3, 5, 30);

export function testDb(): Db {
  const db = createDb(":memory:");
  db.insert(services)
    .values([
      { id: "general", name: "General OPD", prefix: "GEN", defaultMinutes: 10 },
      { id: "lab", name: "Lab", prefix: "LAB", defaultMinutes: 6 },
    ])
    .run();
  db.insert(counters)
    .values([
      { id: "general-1", serviceId: "general", label: "Counter 1", isOpen: 1 },
      { id: "general-2", serviceId: "general", label: "Counter 2", isOpen: 1 },
      { id: "lab-1", serviceId: "lab", label: "Counter 1", isOpen: 1 },
    ])
    .run();
  return db;
}

export function insertRawToken(
  db: Db,
  t: { code: string; phoneHash?: string | null; status: TokenStatus; serviceId?: string },
) {
  const id = randomUUID();
  db.insert(tokens)
    .values({
      id,
      code: t.code,
      serviceId: t.serviceId ?? "general",
      status: t.status,
      confirmedPriority: "routine",
      checkedInAt: T0,
      phoneLast4: "0000",
      phoneHash: t.phoneHash ?? null,
    })
    .run();
  return id;
}
