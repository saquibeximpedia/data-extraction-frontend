import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Role } from '@/lib/types';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

/**
 * Supabase as the signed-in person: the session lives in cookies, refreshed by src/proxy.ts.
 * Server Components can't write cookies, so a refresh there is left to the proxy.
 */
export async function sessionClient(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the proxy keeps the cookies fresh instead
        }
      },
    },
  });
}

let client: SupabaseClient | null = null;

/**
 * Supabase with the service role key. It bypasses row level security, so it is only used on the
 * server: the key has no NEXT_PUBLIC_ prefix and never reaches the browser bundle.
 */
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

/** Roles live in app_metadata, which only the service role can change (users can't promote themselves) */
export function roleOf(user: { app_metadata?: Record<string, unknown> } | null | undefined): Role {
  return user?.app_metadata?.role === 'admin' ? 'admin' : 'user';
}
