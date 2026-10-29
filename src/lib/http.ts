import 'server-only';
import { z } from 'zod';

/** An error with an HTTP status; actions return its message, route handlers answer with it */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: Record<string, unknown>) => new HttpError(400, message, details);
export const notFound = (message: string) => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

/** Parses data with a zod schema, throwing a 400 with the first problem on failure */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const { formErrors, fieldErrors } = z.flattenError(result.error);
    const first = formErrors[0] ?? Object.values(fieldErrors).flat()[0];
    throw badRequest(String(first ?? 'Validation failed'), { details: fieldErrors });
  }
  return result.data;
}

/** Unwraps a Supabase result, turning its error into a 502 */
export async function result<T>(query: PromiseLike<{ data: T; error: { message: string } | null; count?: number | null }>, action: string) {
  const { data, error, count } = await query;
  if (error) throw new HttpError(502, `Database (${action}): ${error.message}`);
  return { data: data as NonNullable<T>, count: count ?? 0 };
}

/** Who is calling, for throttling: the first forwarded address, else "unknown" */
export const callerKeyOf = (headers: Headers) => headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';

/**
 * Failures per key (e.g. a caller's wrong passwords): after `max` within `windowMs`, `check`
 * refuses with a 429. Kept in memory, so each server instance counts on its own.
 */
export function throttle(max: number, windowMs: number, message: string) {
  const failures = new Map<string, { count: number; since: number }>();
  return {
    check(key: string) {
      const entry = failures.get(key);
      if (entry && Date.now() - entry.since < windowMs && entry.count >= max) throw new HttpError(429, message);
    },
    fail(key: string) {
      const entry = failures.get(key);
      if (!entry || Date.now() - entry.since >= windowMs) failures.set(key, { count: 1, since: Date.now() });
      else entry.count++;
      if (failures.size > 5000) failures.clear();
    },
    clear(key: string) {
      failures.delete(key);
    },
  };
}

export async function jsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest('Request body is not valid JSON');
  }
}

/** A zip the browser saves under `name` */
export const zipResponse = (zip: ReadableStream<Uint8Array>, name: string) =>
  new Response(zip as BodyInit, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' } });

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: thrown HttpErrors become JSON with their status, anything else a 500 */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return Response.json({ error: err.message, ...err.details }, { status: err.status });
      console.error(`${req.method} ${new URL(req.url).pathname} failed:`, err);
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}
