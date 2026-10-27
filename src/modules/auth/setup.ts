import 'server-only';
import { supabaseConfigured } from '@/lib/supabase/config';
import { admin, BUCKET } from '@/lib/supabase/server';

/** "https://abcd.supabase.co" → "abcd" */
const refOf = (url: string | undefined) => url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? '';

/** The claims of a legacy JWT key (anon / service_role), or null for the newer sb_… keys */
function claimsOf(key: string): { ref?: string; role?: string } | null {
  const part = key.split('.')[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * What is wrong with this deployment's Supabase settings, if anything, so the sign-in page can say
 * so instead of failing every sign-in. Reports problems only; never keys or URLs.
 */
export async function setupProblems(): Promise<string[]> {
  if (!supabaseConfigured) return ['Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'];
  const problems: string[] = [];
  const browserRef = refOf(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serverRef = refOf(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (browserRef && serverRef && browserRef !== serverRef) {
    problems.push(`The browser signs in to Supabase project "${browserRef}" but the server uses project "${serverRef}". Make SUPABASE_URL match NEXT_PUBLIC_SUPABASE_URL, then rebuild.`);
  }

  if (!key) problems.push('SUPABASE_SERVICE_ROLE_KEY is not set on the server.');
  else if (/^your-|placeholder/i.test(key)) {
    problems.push(
      "SUPABASE_SERVICE_ROLE_KEY is still the placeholder from the template. Set the real key in your host's environment variables (e.g. Vercel → Settings → Environment Variables); .env.local is not deployed."
    );
  } else if (key.startsWith('sb_publishable_')) problems.push('SUPABASE_SERVICE_ROLE_KEY holds the publishable key; use the secret (service_role) key.');
  else {
    const claims = claimsOf(key);
    if (claims?.role && claims.role !== 'service_role') problems.push(`SUPABASE_SERVICE_ROLE_KEY holds the "${claims.role}" key; use the service_role key.`);
    if (claims?.ref && serverRef && claims.ref !== serverRef) problems.push(`SUPABASE_SERVICE_ROLE_KEY belongs to project "${claims.ref}", not "${serverRef}".`);
  }

  // One real call proves the key works for this project
  if (!problems.length) {
    const { error } = await admin().auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) problems.push(`Supabase rejected the server's key: ${error.message}. Check SUPABASE_SERVICE_ROLE_KEY.`);
    else if ((await admin().storage.getBucket(BUCKET)).error) {
      problems.push(`Storage bucket "${BUCKET}" does not exist in this Supabase project. Set SUPABASE_BUCKET to the bucket the extraction service writes to (its own SUPABASE_BUCKET), then redeploy.`);
    }
  }
  return problems;
}
