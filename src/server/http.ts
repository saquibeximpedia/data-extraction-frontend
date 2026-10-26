import { z } from 'zod';
import { admin, roleOf, type Role } from './supabase';

/** An error with an HTTP status; `route()` turns it into `{ error, ...details }` */
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

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
}

// Supabase verifies each token; the result is reused briefly so page loads don't hit Auth every time
const CACHE_MS = 60_000;
const verified = new Map<string, { user: SessionUser; at: number }>();

/** The caller, from `Authorization: Bearer <Supabase access token>` */
export async function requireUser(req: Request): Promise<SessionUser> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Sign in required');

  const hit = verified.get(token);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.user;

  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, signInFailure(error?.message ?? ''));
  const user: SessionUser = { id: data.user.id, email: data.user.email ?? '', role: roleOf(data.user) };
  if (verified.size > 500) verified.clear();
  verified.set(token, { user, at: Date.now() });
  return user;
}

/**
 * Why Supabase rejected a token, in words a person can act on. Only a really expired session says
 * "expired": a wrong key or project on the server would otherwise look like one and loop forever.
 */
function signInFailure(reason: string): string {
  if (/expired/i.test(reason)) return 'Your session has expired. Sign in again.';
  if (/does not exist|not found/i.test(reason)) return 'This account no longer exists. Ask an admin for a new one.';
  console.error(`Sign-in check failed: ${reason || 'no user returned'}`);
  return `The server could not verify your sign-in (${reason || 'no user returned'}). Its Supabase settings probably don't match this app's: SUPABASE_SERVICE_ROLE_KEY must come from the same project as NEXT_PUBLIC_SUPABASE_URL.`;
}

export async function requireAdmin(req: Request): Promise<SessionUser> {
  const user = await requireUser(req);
  if (user.role !== 'admin') throw new HttpError(403, 'Only admins can do this.');
  return user;
}

/** Forgets cached sessions of a user, e.g. after their account is deleted or their role changes */
export function forgetUser(userId: string): void {
  for (const [token, entry] of verified) if (entry.user.id === userId) verified.delete(token);
}

/** Parses data with a zod schema, throwing a 400 with field details on failure */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const { formErrors, fieldErrors } = z.flattenError(result.error);
    const first = formErrors[0] ?? Object.values(fieldErrors).flat()[0];
    throw badRequest(String(first ?? 'Validation failed'), { details: fieldErrors });
  }
  return result.data;
}

export async function jsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw badRequest('Request body is not valid JSON');
  }
}

/** The query string as a plain object */
export const queryOf = (req: Request) => Object.fromEntries(new URL(req.url).searchParams);

/** Unwraps a Supabase result, turning its error into a 502 */
export async function result<T>(query: PromiseLike<{ data: T; error: { message: string } | null; count?: number | null }>, action: string) {
  const { data, error, count } = await query;
  if (error) throw new HttpError(502, `Database (${action}): ${error.message}`);
  return { data: data as NonNullable<T>, count: count ?? 0 };
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: thrown HttpErrors become JSON with their status, anything else a 500 */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return Response.json({ error: err.message, ...err.details }, { status: err.status });
      console.error(`${req.method} ${new URL(req.url).pathname} failed:`, err);
      const message = err instanceof Error && /SUPABASE_SERVICE_ROLE_KEY/.test(err.message) ? err.message : 'Internal server error';
      return Response.json({ error: message }, { status: 500 });
    }
  };
}
