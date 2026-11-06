import { withBody } from "@/lib/api/handler";
import { triageSchema } from "@/lib/api/schemas";
import { decideTriage } from "@/lib/triage/decide";

export const dynamic = "force-dynamic";

export const POST = withBody<typeof triageSchema, { id: string }>(
  triageSchema,
  (body, { id }, db, now) => {
    decideTriage(db, { ...body, tokenId: id, staffLabel: "Staff", now });
  },
);
