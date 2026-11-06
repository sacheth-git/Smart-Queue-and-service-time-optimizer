import { withBody } from "@/lib/api/handler";
import { advanceSchema } from "@/lib/api/schemas";
import { advanceTime } from "@/lib/demo/controls";

export const dynamic = "force-dynamic";

export const POST = withBody(advanceSchema, ({ minutes }, _params, db) => advanceTime(db, minutes));
