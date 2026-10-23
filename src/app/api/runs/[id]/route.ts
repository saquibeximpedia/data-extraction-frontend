import { notFound, requireUser, route } from '@/server/http';
import { runs } from '@/server/runs';

/** GET /api/runs/:id → one extraction as stored */
export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  await requireUser(req);
  const run = await runs.get((await params).id);
  if (!run) throw notFound('This extraction was not found.');
  return Response.json(run);
});
