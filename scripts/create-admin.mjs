/**
 * Creates the first admin account (or promotes an existing account to admin).
 *
 *   npm run create-admin -- --username admin --password 'a-long-password'
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * Later accounts are created by admins in the app (Users page). Accounts sign in with their
 * username; Supabase gets "{username}@users.invalid" as the email, which never receives mail
 * (see src/lib/username.ts).
 */
import { createClient } from '@supabase/supabase-js';

const DOMAIN = 'users.invalid';
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('❌ Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

/** Same rule as the app: the username it was given, else its email before the @ */
const usernameOf = (u) => (typeof u.app_metadata?.username === 'string' && u.app_metadata.username) || (u.email ?? '').split('@')[0].toLowerCase();

async function findByUsername(username) {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) break;
  }
  return users.find((u) => u.app_metadata?.username === username) ?? users.find((u) => usernameOf(u) === username);
}

async function main() {
  const username = arg('username')?.trim().toLowerCase();
  const password = arg('password');
  if (!username || !USERNAME_RE.test(username)) throw new Error('Pass --username with 3–32 letters, digits, dots, dashes or underscores');

  const existing = await findByUsername(username);
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      app_metadata: { ...existing.app_metadata, role: 'admin', username },
      ...(password && { password }),
    });
    if (error) throw error;
    console.log(`✅ ${username} is now an admin${password ? ' (password updated)' : ''}.`);
    return;
  }

  if (!password || password.length < 8) throw new Error('Pass --password with at least 8 characters');
  const { error } = await supabase.auth.admin.createUser({ email: `${username}@${DOMAIN}`, password, email_confirm: true, app_metadata: { role: 'admin', username } });
  if (error) throw error;
  console.log(`✅ Admin ${username} created. Sign in to the app with this username and password.`);
}

main().catch((err) => {
  console.error(`❌ ${err.message ?? err}`);
  process.exit(1);
});
