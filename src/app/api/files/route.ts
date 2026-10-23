import { files } from '@/server/files';
import { queryOf, requireUser, route } from '@/server/http';

/** GET /api/files?country= → stored files, newest first, with country, month and origin */
export const GET = route(async (req) => {
  await requireUser(req);
  const { country } = queryOf(req);
  const list = await files.list(country && /^[A-Za-z]{2,3}$/.test(country) ? country : undefined);
  return Response.json({ count: list.length, files: list });
});
