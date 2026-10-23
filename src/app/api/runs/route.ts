import { z } from 'zod';
import { parse, queryOf, requireUser, route } from '@/server/http';
import { runs } from '@/server/runs';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  country: z.string().regex(/^[A-Za-z]{2,3}$/).optional(),
});

/** GET /api/runs?limit=&country= → extraction history, newest first */
export const GET = route(async (req) => {
  await requireUser(req);
  const { limit, country } = parse(querySchema, queryOf(req));
  return Response.json({ runs: await runs.list(limit, country) });
});
