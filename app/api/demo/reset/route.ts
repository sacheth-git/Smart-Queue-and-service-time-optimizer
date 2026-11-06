import { handle } from "@/lib/api/handler";
import { resetDemo } from "@/lib/db/seed";

export const dynamic = "force-dynamic";

export const POST = handle((_params, db) => resetDemo(db));
