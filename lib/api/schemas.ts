import { z } from "zod";

const priority = z.enum(["urgent", "priority", "routine"]);

export const checkInSchema = z.object({
  serviceId: z.string(),
  phone: z.string(),
  itemCodes: z.array(z.string()),
  idempotencyKey: z.string().min(1),
});
export const tokenActionSchema = z.object({
  action: z.enum(["start", "complete", "no_show", "recall", "cancel"]),
  endedEarly: z.boolean().optional(),
});
export const triageSchema = z.object({ decision: priority, overrideReason: z.string().optional() });
export const counterActionSchema = z.object({ action: z.enum(["open", "close", "call_next"]) });
export const advanceSchema = z.object({ minutes: z.number() });
