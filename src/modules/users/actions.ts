'use server';

import { act } from '@/lib/action';
import { badRequest, conflict, parse } from '@/lib/http';
import { admin } from '@/lib/supabase/server';
import type { Role } from '@/lib/types';
import { emailForUsername } from '@/lib/username';
import { authorizeAdmin, forgetUser } from '@/modules/auth/session';
import { authFail, describeUser, findByUsername } from './queries';
import { createUserSchema, updateUserSchema } from './schemas';

/** A new account that can sign in straight away */
export async function createUser(input: { username: string; password: string; role: Role }) {
  return act(async () => {
    await authorizeAdmin();
    const body = parse(createUserSchema, input);
    if (await findByUsername(body.username)) throw conflict(`The username "${body.username}" is taken.`);
    const { data, error } = await admin().auth.admin.createUser({
      email: emailForUsername(body.username),
      password: body.password,
      email_confirm: true,
      app_metadata: { role: body.role, username: body.username },
    });
    if (error) authFail(error);
    return describeUser(data.user);
  });
}

export async function updateUser(id: string, patch: { role?: Role; password?: string }) {
  return act(async () => {
    const me = await authorizeAdmin();
    const body = parse(updateUserSchema, patch);
    if (id === me.id && body.role === 'user') throw badRequest('You cannot remove your own admin role.');
    const { data, error } = await admin().auth.admin.updateUserById(id, {
      ...(body.password && { password: body.password }),
      ...(body.role && { app_metadata: { role: body.role } }),
    });
    if (error) authFail(error);
    forgetUser(id);
    return describeUser(data.user);
  });
}

export async function deleteUser(id: string) {
  return act(async () => {
    const me = await authorizeAdmin();
    if (id === me.id) throw badRequest('You cannot delete your own account.');
    const { error } = await admin().auth.admin.deleteUser(id);
    if (error) authFail(error);
    forgetUser(id);
    return id;
  });
}
