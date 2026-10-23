import type { User } from '@supabase/supabase-js';
import { z } from 'zod';
import type { AdminUser } from '@/lib/types';
import { HttpError } from './http';
import { admin, roleOf } from './supabase';

export const createUserSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
  role: z.enum(['admin', 'user']).default('user'),
});

export const updateUserSchema = z.object({
  password: z.string().min(8, 'Use at least 8 characters').optional(),
  role: z.enum(['admin', 'user']).optional(),
});

export const describeUser = (u: User): AdminUser => ({
  id: u.id,
  email: u.email ?? '',
  role: roleOf(u),
  createdAt: u.created_at,
  lastSignInAt: u.last_sign_in_at ?? null,
});

/** Supabase errors become 400s with Supabase's own message (e.g. "User already registered") */
export function authFail(error: { message: string; status?: number }): never {
  throw new HttpError(error.status && error.status < 500 ? 400 : 502, error.message);
}

export async function allUsers(): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 200 });
    if (error) authFail(error);
    users.push(...data.users);
    if (data.users.length < 200) return users;
  }
}
