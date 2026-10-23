import { files } from '@/server/files';
import { filePathsSchema } from '@/server/schemas';
import { jsonBody, parse, requireUser, route } from '@/server/http';

/** POST /api/files/zip { paths } → the files as one zip, keeping their folders */
export const POST = route(async (req) => {
  await requireUser(req);
  const { paths } = parse(filePathsSchema, await jsonBody(req));
  const zip = await files.zip([...new Set(paths)]);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return new Response(zip as BodyInit, {
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="trade-data_${stamp}.zip"` },
  });
});
