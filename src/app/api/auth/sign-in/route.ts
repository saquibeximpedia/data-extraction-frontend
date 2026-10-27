import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { HttpError, jsonBody, parse, route } from '@/server/http';
import { callerKeyOf } from '@/server/shares';
import { findByUsername } from '@/server/users';

const signInSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username').max(200),
  password: z.string().min(1, 'Enter your password').max(200),
});

const NO_MATCH = 'That username and password don’t match an account.';

// Failed sign-ins per caller: after MAX_FAILS in the window, further tries are refused (per server instance)
const WINDOW_MS = 15 * 60_000;
const MAX_FAILS = 10;
const failures = new Map<string, { count: number; since: number }>();

function failed(key: string): never {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.since >= WINDOW_MS) failures.set(key, { count: 1, since: Date.now() });
  else entry.count++;
  if (failures.size > 5000) failures.clear();
  throw new HttpError(401, NO_MATCH);
}

/**
 * POST /api/auth/sign-in { username, password } (no sign-in) → { access_token, refresh_token }.
 * The browser hands the tokens to supabase-js, which keeps and refreshes the session as before.
 * Signing in here keeps account emails on the server; an email typed as the username also works.
 */
export const POST = route(async (req) => {
  const key = callerKeyOf(req);
  const entry = failures.get(key);
  if (entry && Date.now() - entry.since < WINDOW_MS && entry.count >= MAX_FAILS) throw new HttpError(429, 'Too many failed sign-ins. Try again in 15 minutes.');

  const { username, password } = parse(signInSchema, await jsonBody(req));
  const email = username.includes('@') ? username : (await findByUsername(username))?.email;
  if (!email) failed(key);

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new HttpError(500, 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on the server.');
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    if (error && !/invalid login|credentials/i.test(error.message)) throw new HttpError(error.status && error.status < 500 ? error.status : 502, error.message);
    failed(key);
  }

  failures.delete(key);
  return Response.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }, { headers: { 'Cache-Control': 'no-store' } });
});
