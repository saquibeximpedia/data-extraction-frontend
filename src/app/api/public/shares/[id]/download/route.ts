import { jsonBody, parse, route } from '@/server/http';
import { shareAccessSchema } from '@/server/schemas';
import { callerKeyOf, shares } from '@/server/shares';

/**
 * POST /api/public/shares/:id/download { password?, path? } (no sign-in)
 * With a path → { url }: a one-minute signed link to that file. Without → every file as one zip.
 */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { password, path } = parse(shareAccessSchema, await jsonBody(req));
  const out = await shares.download((await params).id, password, path, callerKeyOf(req));
  if ('url' in out) return Response.json(out, { headers: { 'Cache-Control': 'no-store' } });
  return new Response(out.zip as BodyInit, {
    headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${out.name}"`, 'Cache-Control': 'no-store' },
  });
});
