import { jsonBody, parse, requireAdmin, route } from '@/server/http';
import { admin } from '@/server/supabase';
import { allUsers, authFail, createUserSchema, describeUser } from '@/server/users';

/** GET /api/admin/users (admin) */
export const GET = route(async (req) => {
  await requireAdmin(req);
  const users = (await allUsers()).map(describeUser).sort((a, b) => a.email.localeCompare(b.email));
  return Response.json({ users });
});

/** POST /api/admin/users { email, password, role } (admin) → account ready to sign in (no confirmation email) */
export const POST = route(async (req) => {
  await requireAdmin(req);
  const body = parse(createUserSchema, await jsonBody(req));
  const { data, error } = await admin().auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    app_metadata: { role: body.role },
  });
  if (error) authFail(error);
  return Response.json(describeUser(data.user), { status: 201 });
});
