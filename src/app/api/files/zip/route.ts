import { z } from 'zod';
import { badRequest, jsonBody, parse, route, zipResponse } from '@/lib/http';
import { filePathsSchema } from '@/lib/schemas';
import { authorize } from '@/modules/auth/session';
import { files } from '@/modules/files/queries';

/**
 * POST /api/files/zip → the files as one streamed zip, keeping their folders (a route, since an action can't send a file).
 * - Form post with `paths` (JSON list): the browser saves the zip as a normal download, with its progress bar.
 * - JSON { paths, check: true }: checks the files exist first (204), so the page can show an error instead.
 */
export const POST = route(async (req) => {
  await authorize();
  const isForm = req.headers.get('content-type')?.includes('application/x-www-form-urlencoded');
  let body: unknown;
  if (isForm) {
    try {
      body = { paths: JSON.parse(String((await req.formData()).get('paths') ?? '')) };
    } catch {
      throw badRequest('paths is not a valid list');
    }
  } else body = await jsonBody(req);
  const { paths, check } = parse(z.object({ paths: filePathsSchema, check: z.boolean().optional() }), body);

  const zip = await files.zip([...new Set(paths)]);
  if (check) {
    await zip.cancel();
    return new Response(null, { status: 204 });
  }
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return zipResponse(zip, `trade-data_${stamp}.zip`);
});
