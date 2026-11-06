import { withBody } from "@/lib/api/handler";
import { checkInSchema } from "@/lib/api/schemas";
import { checkIn } from "@/lib/queue/check-in";

export const dynamic = "force-dynamic";

export const POST = withBody(checkInSchema, (body, _params, db, now) => {
  const { token, outcome } = checkIn(db, { ...body, now });
  return { code: token.code, outcome };
});
