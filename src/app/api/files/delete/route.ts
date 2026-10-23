import { files } from '@/server/files';
import { filePathsSchema } from '@/server/schemas';
import { jsonBody, parse, requireUser, route } from '@/server/http';

/** POST /api/files/delete { paths } */
export const POST = route(async (req) => {
  await requireUser(req);
  const { paths } = parse(filePathsSchema, await jsonBody(req));
  return Response.json({ deleted: await files.remove([...new Set(paths)]) });
});
