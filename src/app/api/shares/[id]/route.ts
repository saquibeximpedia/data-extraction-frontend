import { requireUser, route } from '@/server/http';
import { shares } from '@/server/shares';

/** DELETE /api/shares/:id → revokes the link (it stops working at once) */
export const DELETE = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  await requireUser(req);
  const { id } = await params;
  await shares.remove(id);
  return Response.json({ deleted: id });
});
