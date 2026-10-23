import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client with the service role key, used by the route handlers in
 * src/app/api. It bypasses row level security, so it must never be imported by client code:
 * the key has no NEXT_PUBLIC_ prefix and is not in the browser bundle.
 */
let client: SupabaseClient | null = null;

export function admin(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) in .env.local');
  client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return client;
}

/** Private bucket the extraction service writes to (created by that service on first start) */
export const BUCKET = process.env.SUPABASE_BUCKET || 'trade-exports';

export type Role = 'admin' | 'user';

/** Roles live in app_metadata, which only the service role can change (users can't promote themselves) */
export function roleOf(user: { app_metadata?: Record<string, unknown> } | null | undefined): Role {
  return user?.app_metadata?.role === 'admin' ? 'admin' : 'user';
}
