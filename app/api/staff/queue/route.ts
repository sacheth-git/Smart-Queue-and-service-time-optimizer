import { handle } from "@/lib/api/handler";
import { staffView } from "@/lib/queue/views";

export const dynamic = "force-dynamic";

export const GET = handle((_params, db, now) => ({ ...staffView(db, now), now }));
