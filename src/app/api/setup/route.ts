import { queryOf, route } from '@/server/http';
import { assertBucket } from '@/server/files';
import { admin } from '@/server/supabase';

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
 * GET /api/setup?ref=<the browser's project ref> (no sign-in): what is wrong with this deployment's
 * Supabase settings, if anything, so the sign-in screen can say so instead of "session expired".
 * Reports problems only; never returns keys or URLs.
 */
export const GET = route(async (req) => {
  const problems: string[] = [];
  const browserRef = queryOf(req).ref ?? '';
  const serverUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serverRef = refOf(serverUrl);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!serverUrl) problems.push('The server has no NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL).');
  else if (browserRef && serverRef && browserRef !== serverRef) {
    problems.push(
      `The browser signs in to Supabase project "${browserRef}" but the server checks project "${serverRef}". NEXT_PUBLIC_* values are fixed at build time: set them, then rebuild and redeploy.`
    );
  }

  if (!key) problems.push('SUPABASE_SERVICE_ROLE_KEY is not set on the server.');
  else if (/^your-|placeholder/i.test(key)) {
    problems.push('SUPABASE_SERVICE_ROLE_KEY is still the placeholder from the template. Set the real key in your host\'s environment variables (e.g. Vercel → Settings → Environment Variables); .env.local is not deployed.');
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
    else await assertBucket().catch((err: Error) => problems.push(err.message));
  }

  return Response.json({ ok: problems.length === 0, problems }, { headers: { 'Cache-Control': 'no-store' } });
});
