import { withBody } from "@/lib/api/handler";
import { counterActionSchema } from "@/lib/api/schemas";
import { callNext, closeCounter, openCounter } from "@/lib/queue/counters";

export const dynamic = "force-dynamic";

export const POST = withBody<typeof counterActionSchema, { id: string }>(
  counterActionSchema,
  ({ action }, { id }, db, now) => {
    if (action === "open") return openCounter(db, id);
    if (action === "close") return closeCounter(db, id);
    return { called: callNext(db, id, now)?.code ?? null };
  },
);
