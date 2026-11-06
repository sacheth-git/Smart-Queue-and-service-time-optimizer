import { handle } from "@/lib/api/handler";
import { DomainError } from "@/lib/errors";
import { tokenView } from "@/lib/queue/views";

export const dynamic = "force-dynamic";

export const GET = handle<{ code: string }>(({ code }, db, now) => {
  const view = tokenView(db, code, now);
  if (!view) throw new DomainError("token_not_found", "This token is no longer active", 404);
  return view;
});
