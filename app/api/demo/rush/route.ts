import { handle } from "@/lib/api/handler";
import { simulateRush } from "@/lib/demo/controls";

export const dynamic = "force-dynamic";

export const POST = handle((_params, db, now) => ({ added: simulateRush(db, now) }));
