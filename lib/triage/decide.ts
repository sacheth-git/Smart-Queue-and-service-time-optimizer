import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { tokenEvents, tokens, triageDecisions, type Token } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import type { Priority } from "@/lib/types";

export const OVERRIDE_REASONS = [
  "Assessed in person",
  "Symptoms changed",
  "Information was incorrect",
  "Other clinical judgement",
] as const;

export type TriageDecisionInput = {
  tokenId: string;
  decision: Priority;
  overrideReason?: string;
  staffLabel: string;
  now: number;
};

/** The only way a confirmed priority changes. A person makes this call. */
export function decideTriage(db: Db, input: TriageDecisionInput): Token {
  const { tokenId, decision, overrideReason, staffLabel, now } = input;
  return db.transaction(() => {
    const token = db.select().from(tokens).where(eq(tokens.id, tokenId)).get();
    if (!token) throw new DomainError("token_not_found", "That token no longer exists.", 404);
    if (token.status !== "waiting") {
      throw new DomainError("not_waiting", "Priority can only be set while a patient is waiting.");
    }
    const isOverride = token.suggestedPriority !== null && token.suggestedPriority !== decision;
    if (isOverride && !overrideReason) {
      throw new DomainError("reason_required", "Choose a reason for changing the suggested level.", 400);
    }
    if (overrideReason && !(OVERRIDE_REASONS as readonly string[]).includes(overrideReason)) {
      throw new DomainError("unknown_reason", "Choose a reason from the list.", 400);
    }

    const updated = db
      .update(tokens)
      .set({ confirmedPriority: decision, triageReviewedAt: now })
      .where(eq(tokens.id, tokenId))
      .returning()
      .get();
    db.insert(triageDecisions)
      .values({
        tokenCode: token.code,
        suggested: token.suggestedPriority,
        reasonsJson: token.reasonsJson,
        decision,
        overrideReason: overrideReason ?? null,
        staffLabel,
        at: now,
      })
      .run();
    db.insert(tokenEvents).values({ tokenId, type: "triage_decided", at: now, actor: staffLabel }).run();
    return updated;
  });
}
