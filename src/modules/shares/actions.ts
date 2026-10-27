'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { act } from '@/lib/action';
import { callerKeyOf, parse } from '@/lib/http';
import { filePathsSchema } from '@/lib/schemas';
import { authorize } from '@/modules/auth/session';
import { shares } from './queries';

const createShareSchema = z.object({
  paths: filePathsSchema,
  title: z.string().trim().max(120).optional(),
  // Empty or missing: anyone with the link can download
  password: z.string().max(200).optional().transform((v) => v || undefined).pipe(z.string().min(4, 'Use a password of at least 4 characters').optional()),
  // null: never expires
  expiresInDays: z.number().int().min(1).max(365).nullable().default(7),
});

/** A link anyone can open at /s/{id} to download the files */
export async function createShare(input: z.input<typeof createShareSchema>) {
  return act(async () => {
    const user = await authorize();
    return shares.create(parse(createShareSchema, input), user.username);
  });
}

/** Revokes a link: it stops working at once */
export async function deleteShare(id: string) {
  return act(async () => {
    await authorize();
    await shares.remove(id);
  });
}

/** Public (no sign-in): unlocks a link with its password; a wrong one is a 401 */
export async function unlockShare(id: string, password: string) {
  return act(async () => shares.open(id, parse(z.string().max(200), password),callerKeyOf(await headers())), { revalidate: false });
}
