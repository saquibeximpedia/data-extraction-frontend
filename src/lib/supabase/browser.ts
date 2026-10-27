import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

/**
 * Supabase in the browser: reads the session the server set in cookies. Used for the access token
 * the extraction service checks, and for uploading straight to Storage with a signed upload token.
 */
export const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
