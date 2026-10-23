import { files } from '@/server/files';
import { badRequest, queryOf, requireUser, route } from '@/server/http';

/** GET /api/files/url?path= → { url }: a signed link that downloads the file for five minutes */
export const GET = route(async (req) => {
  await requireUser(req);
  const { path } = queryOf(req);
  if (!path) throw badRequest('path is required');
  return Response.json({ url: await files.signedUrl(path) });
});
