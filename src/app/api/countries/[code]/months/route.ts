import { countries, monthChangesSchema } from '@/server/countries';
import { jsonBody, parse, requireUser, route } from '@/server/http';

type Ctx = { params: Promise<{ code: string }> };

/**
 * POST /api/countries/:code/months { changes: [{ period, status }] }
 * status 'completed' or 'extracting' sets the month; null clears it (files are kept).
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { code } = await params;
  const { changes } = parse(monthChangesSchema, await jsonBody(req));
  const changed = await countries.setMonths(code, changes, user.username);
  return Response.json({ changed, country: await countries.get(code) });
});
