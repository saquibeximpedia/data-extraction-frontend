import { countries, countryPatchSchema } from '@/server/countries';
import { jsonBody, parse, requireAdmin, route } from '@/server/http';

type Ctx = { params: Promise<{ code: string }> };

/** PATCH /api/countries/:code (admin) → edits name, source links and text, notes, lag, publish day, start month */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireAdmin(req);
  const patch = parse(countryPatchSchema, await jsonBody(req));
  return Response.json(await countries.update((await params).code, patch, user.username));
});

/** DELETE /api/countries/:code (admin) → removes a download-only country */
export const DELETE = route<Ctx>(async (req, { params }) => {
  await requireAdmin(req);
  const { code } = await params;
  await countries.removeManual(code);
  return Response.json({ deleted: code.toUpperCase() });
});
