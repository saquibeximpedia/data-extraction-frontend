'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { act } from '@/lib/action';
import { callerKeyOf, HttpError, parse, throttle } from '@/lib/http';
import { sessionClient } from '@/lib/supabase/server';
import { findByUsername } from '@/modules/users/queries';

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

export async function signOut() {
  await (await sessionClient()).auth.signOut();
  redirect('/login');
}
