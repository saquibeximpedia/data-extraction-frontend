import { z } from 'zod';
import { jsonBody, parse, route, zipResponse } from '@/lib/http';
import { filePathsSchema } from '@/lib/schemas';
import { authorize } from '@/modules/auth/session';
import { files } from '@/modules/files/queries';

/** POST /api/files/zip { paths } → the files as one zip, keeping their folders (a route, since an action can't send a file) */
export const POST = route(async (req) => {
  await authorize();
  const { paths } = parse(z.object({ paths: filePathsSchema }), await jsonBody(req));
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return zipResponse(await files.zip([...new Set(paths)]), `trade-data_${stamp}.zip`);
});
