import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { tokenEvents, tokens, type Token } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { FINAL_STATUSES, type TokenStatus } from "@/lib/types";

const LEGAL: Record<TokenStatus, TokenStatus[]> = {
  waiting: ["called", "cancelled"],
  called: ["serving", "cancelled", "no_show", "waiting"],
  serving: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export type TransitionContext = {
  now: number;
  actor: string;
  counterId?: string;
  endedEarly?: boolean;
};

/** The only code allowed to change the status of a token. */
export function transition(db: Db, tokenId: string, to: TokenStatus, ctx: TransitionContext): Token {
  return db.transaction(() => {
    const token = db.select().from(tokens).where(eq(tokens.id, tokenId)).get();
    if (!token) throw new DomainError("token_not_found", "That token no longer exists.", 404);
    if (!LEGAL[token.status].includes(to)) {
      throw new DomainError(
        "illegal_transition",
        `Cannot move token ${token.code} from ${token.status} to ${to}.`,
      );
    }
    if (to === "called" && !ctx.counterId) {
      throw new DomainError("counter_required", "A counter is needed to call a token.");
    }

    const changes: Partial<Token> = { status: to };
    if (to === "called") {
      changes.calledAt = ctx.now;
      changes.counterId = ctx.counterId;
    } else if (to === "serving") {
      changes.startedAt = ctx.now;
    } else if (to === "waiting") {
      changes.calledAt = null;
      changes.counterId = null;
    } else if ((FINAL_STATUSES as readonly string[]).includes(to)) {
      changes.finishedAt = ctx.now;
      changes.phoneHash = null;
      changes.itemCodesJson = null;
      changes.reasonsJson = null;
      changes.counterId = null;
      if (ctx.endedEarly) changes.endedEarly = 1;
    }

    const updated = db.update(tokens).set(changes).where(eq(tokens.id, tokenId)).returning().get();
    db.insert(tokenEvents)
      .values({ tokenId, type: "status", fromStatus: token.status, toStatus: to, at: ctx.now, actor: ctx.actor })
      .run();
    return updated;
  });
}
