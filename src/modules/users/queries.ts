import 'server-only';
import type { User } from '@supabase/supabase-js';
import { conflict, HttpError } from '@/lib/http';
import { admin, roleOf } from '@/lib/supabase/server';
import type { AdminUser } from '@/lib/types';
import { normalizeUsername, usernameOf } from '@/lib/username';

export const describeUser = (u: User): AdminUser => ({
  id: u.id,
  username: usernameOf(u),
  role: roleOf(u),
  createdAt: u.created_at,
  lastSignInAt: u.last_sign_in_at ?? null,
});

/** Supabase Auth errors become 400s with Supabase's own message (e.g. "User already registered") */
export function authFail(error: { message: string; status?: number }): never {
  throw new HttpError(error.status && error.status < 500 ? 400 : 502, error.message);
}

async function allUsers(): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 200 });
    if (error) authFail(error);
    users.push(...data.users);
    if (data.users.length < 200) return users;
  }
}

/** Every account, by username */
export async function listUsers(): Promise<AdminUser[]> {
  return (await allUsers()).map(describeUser).sort((a, b) => a.username.localeCompare(b.username));
}

/**
 * The account with this username, or null. A username given in app_metadata wins over one taken
 * from an email; two older accounts whose emails start the same way can't be told apart.
 */
export async function findByUsername(name: string): Promise<User | null> {
  const wanted = normalizeUsername(name);
  const users = await allUsers();
  const given = users.find((u) => u.app_metadata?.username === wanted);
  if (given) return given;
  const derived = users.filter((u) => usernameOf(u) === wanted);
  if (derived.length > 1) throw conflict(`More than one account answers to "${wanted}". Ask an admin to give each a username.`);
  return derived[0] ?? null;
}
