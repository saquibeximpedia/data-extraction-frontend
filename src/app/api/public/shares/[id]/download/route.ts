import { z } from 'zod';
import { callerKeyOf, jsonBody, parse, route, zipResponse } from '@/lib/http';
import { shares } from '@/modules/shares/queries';

const accessSchema = z.object({ password: z.string().max(200).optional(), path: z.string().min(1).optional() });

/**
 * POST /api/public/shares/:id/download { password?, path? } (no sign-in)
 * With a path → { url }: a one-minute signed link to that file. Without → every file as one zip.
 */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { password, path } = parse(accessSchema, await jsonBody(req));
  const out = await shares.download((await params).id, password, path, callerKeyOf(req.headers));
  return 'url' in out ? Response.json(out, { headers: { 'Cache-Control': 'no-store' } }) : zipResponse(out.zip, out.name);
});
