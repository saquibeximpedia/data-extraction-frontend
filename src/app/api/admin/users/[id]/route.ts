import { badRequest, forgetUser, jsonBody, parse, requireAdmin, route } from '@/server/http';
import { admin } from '@/server/supabase';
import { authFail, describeUser, updateUserSchema } from '@/server/users';

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/admin/users/:id { role?, password? } (admin) */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const me = await requireAdmin(req);
  const { id } = await params;
  const body = parse(updateUserSchema, await jsonBody(req));
  if (id === me.id && body.role === 'user') throw badRequest('You cannot remove your own admin role.');
  const { data, error } = await admin().auth.admin.updateUserById(id, {
    ...(body.password && { password: body.password }),
    ...(body.role && { app_metadata: { role: body.role } }),
  });
  if (error) authFail(error);
  forgetUser(id);
  return Response.json(describeUser(data.user));
});

/** DELETE /api/admin/users/:id (admin) */
export const DELETE = route<Ctx>(async (req, { params }) => {
  const me = await requireAdmin(req);
  const { id } = await params;
  if (id === me.id) throw badRequest('You cannot delete your own account.');
  const { error } = await admin().auth.admin.deleteUser(id);
  if (error) authFail(error);
  forgetUser(id);
  return Response.json({ deleted: id });
});
