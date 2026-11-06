import { withBody } from "@/lib/api/handler";
import { addCounterSchema } from "@/lib/api/schemas";
import { addCounter } from "@/lib/queue/counters";

export const dynamic = "force-dynamic";

export const POST = withBody(addCounterSchema, (input, _params, db) => addCounter(db, input));
