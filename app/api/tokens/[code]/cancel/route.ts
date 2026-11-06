import { eq } from "drizzle-orm";
import { handle } from "@/lib/api/handler";
import { tokens } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { transition } from "@/lib/queue/transitions";

export const dynamic = "force-dynamic";

export const POST = handle<{ code: string }>(({ code }, db, now) => {
  const token = db.select().from(tokens).where(eq(tokens.code, code)).get();
  if (!token) throw new DomainError("token_not_found", "This token is no longer active", 404);
  transition(db, token.id, "cancelled", { now, actor: "patient" });
});
