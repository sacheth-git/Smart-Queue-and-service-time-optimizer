import { handle } from "@/lib/api/handler";
import { homeView } from "@/lib/queue/views";

export const dynamic = "force-dynamic";

export const GET = handle((_params, db, now) => ({ services: homeView(db, now) }));
