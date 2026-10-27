import { jsonBody, parse, route } from '@/server/http';
import { shareAccessSchema } from '@/server/schemas';
import { callerKeyOf, shares } from '@/server/shares';

const noStore = { headers: { 'Cache-Control': 'no-store' } };

/** GET /api/public/shares/:id (no sign-in) → the link's title and expiry; its files too unless it has a password */
export const GET = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  return Response.json(await shares.open((await params).id, undefined, callerKeyOf(req)), noStore);
});

/** POST /api/public/shares/:id { password } (no sign-in) → unlocks the link: 401 on a wrong password */
export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { password } = parse(shareAccessSchema, await jsonBody(req));
  return Response.json(await shares.open((await params).id, password ?? '', callerKeyOf(req)), noStore);
});
