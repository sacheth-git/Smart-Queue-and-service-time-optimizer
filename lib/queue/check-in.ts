import { randomUUID } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { services, tokenEvents, tokens, type Token } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { hashPhone } from "@/lib/queue/phone";
import { estimateForToken } from "@/lib/queue/views";
import { assertKnownItems, suggestPriority } from "@/lib/triage/rules";
import { ACTIVE_STATUSES } from "@/lib/types";

export type CheckInInput = {
  serviceId: string;
  phone: string;
  itemCodes: string[];
  idempotencyKey: string;
  now: number;
};
export type CheckInResult = { token: Token; outcome: "created" | "existing" | "updated" };

function mergeItems(db: Db, active: Token, itemCodes: string[], now: number): CheckInResult {
  const known: string[] = JSON.parse(active.itemCodesJson ?? "[]");
  const added = itemCodes.filter((c) => !known.includes(c));
  if (added.length === 0) return { token: active, outcome: "existing" };

  const merged = [...known, ...added];
  const suggestion = suggestPriority(merged);
  const changed = suggestion?.level !== active.suggestedPriority;
  const token = db
    .update(tokens)
    .set({
      itemCodesJson: JSON.stringify(merged),
      suggestedPriority: suggestion?.level ?? null,
      reasonsJson: JSON.stringify(suggestion?.reasons ?? []),
      triageReviewedAt: changed ? null : active.triageReviewedAt,
    })
    .where(eq(tokens.id, active.id))
    .returning()
    .get();
  db.insert(tokenEvents)
    .values({ tokenId: active.id, type: "items_added", at: now, actor: "patient" })
    .run();
  return { token, outcome: "updated" };
}

export function checkIn(db: Db, input: CheckInInput): CheckInResult {
  const { serviceId, phone, itemCodes, idempotencyKey, now } = input;
  if (!/^\d{10}$/.test(phone)) {
    throw new DomainError("invalid_phone", "Enter a 10-digit phone number.", 400);
  }
  assertKnownItems(itemCodes);

  return db.transaction((): CheckInResult => {
    const service = db.select().from(services).where(eq(services.id, serviceId)).get();
    if (!service) throw new DomainError("unknown_service", "That service is not available.", 400);

    const replay = db.select().from(tokens).where(eq(tokens.idempotencyKey, idempotencyKey)).get();
    if (replay) return { token: replay, outcome: "existing" };

    const phoneHash = hashPhone(db, phone);
    const active = db
      .select()
      .from(tokens)
      .where(
        and(
          eq(tokens.phoneHash, phoneHash),
          eq(tokens.serviceId, serviceId),
          inArray(tokens.status, [...ACTIVE_STATUSES]),
        ),
      )
      .get();
    if (active) return mergeItems(db, active, itemCodes, now);

    const issued = db
      .select({ n: count() })
      .from(tokens)
      .where(eq(tokens.serviceId, serviceId))
      .get()!.n;
    const suggestion = suggestPriority(itemCodes);
    const token = db
      .insert(tokens)
      .values({
        id: randomUUID(),
        code: `${service.prefix}-${String(issued + 1).padStart(3, "0")}`,
        serviceId,
        status: "waiting",
        suggestedPriority: suggestion?.level ?? null,
        reasonsJson: suggestion ? JSON.stringify(suggestion.reasons) : null,
        itemCodesJson: itemCodes.length ? JSON.stringify(itemCodes) : null,
        confirmedPriority: "routine",
        checkedInAt: now,
        idempotencyKey,
        phoneLast4: phone.slice(-4),
        phoneHash,
      })
      .returning()
      .get();
    db.insert(tokenEvents)
      .values({ tokenId: token.id, type: "checked_in", toStatus: "waiting", at: now, actor: "patient" })
      .run();

    const estimate = estimateForToken(db, token, now);
    if (estimate.kind === "no_counter") return { token, outcome: "created" };
    const withEstimate = db
      .update(tokens)
      .set({ estLowMin: estimate.lowMin, estHighMin: estimate.highMin, estMidMin: estimate.midMin })
      .where(eq(tokens.id, token.id))
      .returning()
      .get();
    return { token: withEstimate, outcome: "created" };
  });
}
