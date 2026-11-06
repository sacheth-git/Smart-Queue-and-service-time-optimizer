import { handle } from "@/lib/api/handler";
import { displayView } from "@/lib/queue/views";

export const dynamic = "force-dynamic";

export const GET = handle((_params, db) => ({ services: displayView(db) }));
