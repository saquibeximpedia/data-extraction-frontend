import { countries, newCountrySchema } from '@/server/countries';
import { jsonBody, parse, requireAdmin, requireUser, route } from '@/server/http';

/** GET /api/countries → every country with its source, settings, completed and extracting months */
export const GET = route(async (req) => {
  await requireUser(req);
  return Response.json({ countries: await countries.list() });
});

/** POST /api/countries (admin) → adds a download-only country */
export const POST = route(async (req) => {
  const user = await requireAdmin(req);
  const body = parse(newCountrySchema, await jsonBody(req));
  return Response.json(await countries.createManual(body, user.email), { status: 201 });
});
