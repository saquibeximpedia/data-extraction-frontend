import { emailForUsername } from '@/lib/username';
import { conflict, jsonBody, parse, requireAdmin, route } from '@/server/http';
import { admin } from '@/server/supabase';
import { allUsers, authFail, createUserSchema, describeUser, findByUsername } from '@/server/users';

/** GET /api/admin/users (admin) */
export const GET = route(async (req) => {
  await requireAdmin(req);
  const users = (await allUsers()).map(describeUser).sort((a, b) => a.username.localeCompare(b.username));
  return Response.json({ users });
});

/** POST /api/admin/users { username, password, role } (admin) → account ready to sign in */
export const POST = route(async (req) => {
  await requireAdmin(req);
  const body = parse(createUserSchema, await jsonBody(req));
  if (await findByUsername(body.username)) throw conflict(`The username "${body.username}" is taken.`);
  const { data, error } = await admin().auth.admin.createUser({
    email: emailForUsername(body.username),
    password: body.password,
    email_confirm: true,
    app_metadata: { role: body.role, username: body.username },
  });
  if (error) authFail(error);
  return Response.json(describeUser(data.user), { status: 201 });
});
