'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { act } from '@/lib/action';
import { callerKeyOf, HttpError, parse, throttle } from '@/lib/http';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/config';
import { admin, sessionClient } from '@/lib/supabase/server';
import { findByUsername } from '@/modules/users/queries';
import { password } from '@/modules/users/schemas';
import { authorize } from './session';

const signInSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username').max(200),
  password: z.string().min(1, 'Enter your password').max(200),
});

const NO_MATCH = 'That username and password don’t match an account.';
const signIns = throttle(10, 15 * 60_000, 'Too many failed sign-ins. Try again in 15 minutes.');

/**
 * Signs in by username (an email typed as the username also works) and keeps the session in
 * cookies. Account emails stay on the server.
 */
export async function signIn(username: string, password: string) {
  return act(
    async () => {
      const key = callerKeyOf(await headers());
      signIns.check(key);
      const body = parse(signInSchema, { username, password });
      const noMatch = () => {
        signIns.fail(key);
        return new HttpError(401, NO_MATCH);
      };

      const email = body.username.includes('@') ? body.username : (await findByUsername(body.username))?.email;
      if (!email) throw noMatch();
      const { error } = await (await sessionClient()).auth.signInWithPassword({ email, password: body.password });
      if (error) {
        if (/invalid login|credentials/i.test(error.message)) throw noMatch();
        throw new HttpError(error.status && error.status < 500 ? error.status : 502, error.message);
      }
      signIns.clear(key);
      return null;
    },
    { revalidate: false }
  );
}

const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Enter your current password').max(200), newPassword: password })
  .refine((b) => b.newPassword !== b.currentPassword, 'The new password must differ from the current one');

const passwordChecks = throttle(5, 15 * 60_000, 'Too many wrong passwords. Try again in 15 minutes.');

/**
 * The signed-in person sets a new password after confirming the current one. Their other
 * sessions are signed out; this one stays.
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  return act(
    async () => {
      const me = await authorize();
      passwordChecks.check(me.id);
      const body = parse(changePasswordSchema, { currentPassword, newPassword });

      const { data: found, error: findError } = await admin().auth.admin.getUserById(me.id);
      if (findError || !found.user?.email) throw new HttpError(502, findError?.message ?? 'Your account could not be found.');

      // Checked on a throwaway client so the session cookies are left alone; its session is revoked right after
      const probe = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error: checkError } = await probe.auth.signInWithPassword({ email: found.user.email, password: body.currentPassword });
      if (checkError) {
        if (!/invalid login|credentials/i.test(checkError.message)) throw new HttpError(checkError.status && checkError.status < 500 ? checkError.status : 502, checkError.message);
        passwordChecks.fail(me.id);
        throw new HttpError(400, 'Your current password is not right.');
      }
      passwordChecks.clear(me.id);
      await probe.auth.signOut({ scope: 'local' });

      const { error } = await admin().auth.admin.updateUserById(me.id, { password: body.newPassword });
      if (error) throw new HttpError(error.status && error.status < 500 ? error.status : 502, error.message);
      await (await sessionClient()).auth.signOut({ scope: 'others' });
      return null;
    },
    { revalidate: false }
  );
}

export async function signOut() {
  await (await sessionClient()).auth.signOut();
  redirect('/login');
}
