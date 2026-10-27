import { createShareSchema } from '@/server/schemas';
import { jsonBody, parse, requireUser, route } from '@/server/http';
import { shares } from '@/server/shares';

/** GET /api/shares → every share link, newest first */
export const GET = route(async (req) => {
  await requireUser(req);
  return Response.json({ shares: await shares.list() });
});

/** POST /api/shares { paths, title?, password?, expiresInDays? } → the new link (its id goes in /s/{id}) */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  const body = parse(createShareSchema, await jsonBody(req));
  return Response.json(await shares.create(body, user.email), { status: 201 });
});
