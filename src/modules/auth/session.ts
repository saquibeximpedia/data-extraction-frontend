import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { HttpError } from '@/lib/http';
import { roleOf, sessionClient } from '@/lib/supabase/server';
import type { Me } from '@/lib/types';
import { usernameOf } from '@/lib/username';

// Supabase verifies each session; the result is reused briefly so page loads don't hit Auth every time
const CACHE_MS = 60_000;
const verified = new Map<string, { user: Me; at: number }>();

/** The signed-in person from the session cookie (verified with Supabase), or null */
export const currentUser = cache(async (): Promise<Me | null> => {
  const supabase = await sessionClient();
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) return null;

  const hit = verified.get(token);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.user;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    if (error && !/expired|not found|does not exist|missing/i.test(error.message)) console.error(`Sign-in check failed: ${error.message}`);
    return null;
  }
  const user: Me = { id: data.user.id, username: usernameOf(data.user), role: roleOf(data.user) };
  if (verified.size > 500) verified.clear();
  verified.set(token, { user, at: Date.now() });
  return user;
});

/** Pages: the signed-in person, else off to the sign-in page */
export async function requireUser(): Promise<Me> {
  return (await currentUser()) ?? redirect('/login');
}

/** Admin pages: other people go back to the dashboard */
export async function requireAdmin(): Promise<Me> {
  const user = await requireUser();
  return user.role === 'admin' ? user : redirect('/');
}

/** Actions and route handlers: the signed-in person, else a 401 */
export async function authorize(): Promise<Me> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, 'Your session has expired. Sign in again.');
  return user;
}

export async function authorizeAdmin(): Promise<Me> {
  const user = await authorize();
  if (user.role !== 'admin') throw new HttpError(403, 'Only admins can do this.');
  return user;
}

/** Forgets verified sessions of a user, e.g. after their account is deleted or their role changes */
export function forgetUser(userId: string): void {
  for (const [token, entry] of verified) if (entry.user.id === userId) verified.delete(token);
}
