import type { z } from "zod";
import { demoNow } from "@/lib/clock";
import { getDb, type Db } from "@/lib/db/client";
import { DomainError } from "@/lib/errors";

type RouteContext<P> = { params: Promise<P> };

const failure = (code: string, message: string, status: number) =>
  Response.json({ error: { code, message } }, { status });

async function guard(run: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json((await run()) ?? { ok: true });
  } catch (error) {
    if (error instanceof DomainError) return failure(error.code, error.message, error.status);
    if (error instanceof SyntaxError) return failure("bad_json", "The request could not be read.", 400);
    console.error(error);
    return failure("server_error", "Something went wrong. Please try again.", 500);
  }
}

export function handle<P = object>(fn: (params: P, db: Db, now: number) => unknown) {
  return (_request: Request, context?: RouteContext<P>) =>
    guard(async () => {
      const db = getDb();
      return fn((await context?.params) as P, db, demoNow(db));
    });
}

export function withBody<S extends z.ZodType, P = object>(
  schema: S,
  fn: (body: z.infer<S>, params: P, db: Db, now: number) => unknown,
) {
  return (request: Request, context?: RouteContext<P>) =>
    guard(async () => {
      const parsed = schema.safeParse(JSON.parse(await request.text()));
      if (!parsed.success) {
        throw new DomainError("invalid_request", "Some details are missing or invalid.", 400);
      }
      const db = getDb();
      return fn(parsed.data, (await context?.params) as P, db, demoNow(db));
    });
}
