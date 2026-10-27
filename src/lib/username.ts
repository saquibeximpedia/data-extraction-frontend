// People sign in with a username. Supabase Auth needs an email behind each account, so an
// account created here gets "{username}@users.invalid": the .invalid domain is reserved and can
// never receive mail, and nobody types or sees it. Older accounts made with a real email keep it;
// their username is set in app_metadata, or else is the part of the email before the @.

export const ACCOUNT_DOMAIN = 'users.invalid';

/** 3–32 characters: lowercase letters, digits, dot, dash, underscore; starts with a letter or digit */
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export const normalizeUsername = (value: string) => value.trim().toLowerCase();

export const emailForUsername = (username: string) => `${normalizeUsername(username)}@${ACCOUNT_DOMAIN}`;

/** An account's username: the one it was given, else its email before the @ */
export function usernameOf(user: { email?: string | null; app_metadata?: Record<string, unknown> } | null | undefined): string {
  const given = user?.app_metadata?.username;
  if (typeof given === 'string' && given) return given;
  return (user?.email ?? '').split('@')[0].toLowerCase();
}
