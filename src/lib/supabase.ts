import { createClient } from '@supabase/supabase-js';

/**
 * Browser Supabase client: keeps the session (sign-in goes through /api/auth/sign-in, by username).
 * Uses the public anon key only; accounts are created by admins through the API.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project-ref.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'missing-anon-key'
);

export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-ref')
);
