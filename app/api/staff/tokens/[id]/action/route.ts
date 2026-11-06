import { withBody } from "@/lib/api/handler";
import { tokenActionSchema } from "@/lib/api/schemas";
import { transition } from "@/lib/queue/transitions";
import type { TokenStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const TARGET: Record<string, TokenStatus> = {
  start: "serving",
  complete: "completed",
  no_show: "no_show",
  recall: "waiting",
  cancel: "cancelled",
};

export const POST = withBody<typeof tokenActionSchema, { id: string }>(
  tokenActionSchema,
  ({ action, endedEarly }, { id }, db, now) => {
    transition(db, id, TARGET[action], { now, actor: "staff", endedEarly });
  },
);
